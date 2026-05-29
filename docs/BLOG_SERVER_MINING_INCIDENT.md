# 我还以为是内存泄漏，没想到是服务器被人下了蛊

> 一次真实的服务器入侵排查经历

## 起因

2026年5月29日晚上，用户反馈网站登录后点击其他功能需要重新登录。我第一反应是认证系统出了问题，开始排查代码。

但很快，更多的问题接踵而来：
- API请求超时 (`net::ERR_TIMED_OUT`)
- 页面加载缓慢
- 服务器响应不稳定

我开始怀疑是服务器资源问题。

## 第一次误判：内存泄漏

登录服务器查看资源使用情况：

```
top - 19:10:55 up 11 days, 20:34
load average: 84.99, 76.23, 76.46
%Cpu(s):  0.0 us,  3.3 sy,  0.0 ni, 83.3 id, 13.3 wa
MiB Mem :   3495.2 total,    334.2 free,   2526.8 used
MiB Swap:   2048.0 total,    452.8 free,   1595.2 used
```

**CPU负载 84.99，内存几乎用完，Swap用了1.6GB**

我的第一反应是：Next.js应用内存泄漏了。毕竟这是一个全栈应用，有数据库连接、SSE推送、实时聊天等功能，内存泄漏是很常见的问题。

于是我开始：
1. 检查PM2进程内存使用
2. 分析数据库连接池
3. 检查SSE连接是否正确释放

PM2报告显示每个实例只用了50-100MB内存，看起来很正常。

"奇怪，那内存去哪了？"

## 真相大白

当我执行 `ps aux --sort=-%mem` 查看内存占用最高的进程时，发现了端倪：

```
USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
root      415370  188  7.5 2442240 270676 ?      Ssl  19:20   1:37 systemd -o xmr.kryptex.network:8029 -u 47S6DU9Qm3K848Krv6fAfZGgRn75653nbEPMxx3CYrWXBeTYnttJaWCDxDErGhH53u2cmbwahUymzPx71qDPneMsGjQ5pj4 --tls -t 2 --cpu-max-threads-hint=100
```

**188% CPU，连接到 xmr.kryptex.network:8029**

这是什么？我仔细一看：

- 进程名：`systemd`（伪装成系统进程）
- 连接地址：`xmr.kryptex.network`（门罗币矿池）
- 参数：`--cpu-max-threads-hint=100`（使用100% CPU）

**这不是内存泄漏，这是服务器被植入了挖矿程序！**

## 排查过程

### 1. 确认挖矿程序

```bash
ps aux | grep -E 'kryptex|xmr|mine'
```

输出：
```
root      415370  188  7.5 2442240 270676 ?      Ssl  19:20   1:37 systemd -o xmr.kryptex.network:8029 ...
```

确认是挖矿程序。

### 2. 查找程序位置

```bash
ls -la /proc/415370/exe
# 输出：lrwxrwxrwx 1 root root 0 May 29 19:26 /proc/415370/exe -> /usr/local/bin/systemd
```

挖矿程序伪装成了 `/usr/local/bin/systemd`，一个假的systemd二进制文件。

### 3. 检查自动重启机制

第一次直接 `kill` 进程，结果几秒后又启动了。说明有定时任务或服务在自动重启它。

检查systemd服务：
```bash
systemctl list-units --type=service --state=running
```

发现一个可疑服务：`observed.service` - "System Observer Service"

但进一步检查发现这个服务只是一个清理脚本，不是挖矿程序的来源。

### 4. 彻底清除

```bash
# 杀死进程
kill -9 415370

# 删除挖矿程序
rm -f /usr/local/bin/systemd
```

## 清理结果

| 指标 | 清理前 | 清理后 |
|------|--------|--------|
| CPU负载 | 84.99 | 1.59 |
| 挖矿进程CPU | 186% | 0% |
| 挖矿进程内存 | 270MB | 0MB |

**CPU负载降低了98%！**

## 入侵路径分析

挖矿程序是如何进入服务器的？可能的途径：

1. **SSH弱密码** - 攻击者通过暴力破解SSH密码
2. **软件漏洞** - 服务器上运行的软件存在安全漏洞
3. **供应链攻击** - 安装的软件包被篡改
4. **宝塔面板漏洞** - 宝塔面板存在安全漏洞

## 加固措施

### 立即措施

1. ✅ 清除挖矿程序
2. ✅ 检查并清理定时任务
3. ✅ 检查systemd服务

### 后续措施

1. **更换服务器密码** - 使用强密码
2. **限制SSH访问** - 禁用密码登录，只允许密钥认证
3. **更新系统** - 确保所有软件都是最新版本
4. **配置防火墙** - 只开放必要的端口
5. **定期安全扫描** - 使用安全工具定期扫描服务器
6. **监控资源使用** - 设置CPU、内存使用告警

## 经验教训

1. **不要只看表面现象** - CPU负载高不一定是应用问题，可能是被入侵
2. **检查进程来源** - 不要只看进程名，要检查进程的完整路径和参数
3. **注意自动重启机制** - 挖矿程序通常会配置自动重启，要彻底清除
4. **定期安全检查** - 不要等出了问题才检查

## 总结

这次事件给我敲响了警钟。服务器安全不是一劳永逸的事情，需要持续关注和维护。

如果你的服务器也出现CPU负载异常高的情况，不要急着优化代码，先检查一下是不是被入侵了。

---

*写于2026年5月29日晚，服务器恢复正常后*

## 附录：快速排查命令

```bash
# 检查CPU负载
uptime

# 检查内存使用
free -h

# 查看CPU占用最高的进程
ps aux --sort=-%cpu | head -10

# 查看内存占用最高的进程
ps aux --sort=-%mem | head -10

# 检查可疑进程
ps aux | grep -E 'mine|xmr|kryptex|cryptonight'

# 检查定时任务
crontab -l

# 检查systemd服务
systemctl list-units --type=service --state=running

# 检查进程的完整路径
ls -la /proc/<PID>/exe
```
