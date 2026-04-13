/**
 * 测试原生 fetch 请求
 */

async function testNativeFetch() {
  const apiKey = 'bef4394a-b5e8-4002-9bf0-82ee31f5fae2';
  const url = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
  const model = 'deepseek-v3-250324';
  
  console.log('测试配置:');
  console.log(`  URL: ${url}`);
  console.log(`  Model: ${model}`);
  console.log('');
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'user', content: 'Hello' }
        ],
        max_tokens: 5,
      }),
    });
    
    console.log(`响应状态码：${response.status}`);
    console.log(`响应头:`, Object.fromEntries(response.headers.entries()));
    console.log('');
    
    const data = await response.json();
    console.log('响应数据:');
    console.log(JSON.stringify(data, null, 2));
    
    if (response.ok) {
      console.log('\n✅ 请求成功!');
    } else {
      console.log('\n❌ 请求失败');
      
      if (data.error) {
        console.log('\n错误详情:');
        console.log(`  代码：${data.error.code}`);
        console.log(`  消息：${data.error.message}`);
        console.log(`  类型：${data.error.type}`);
        
        if (data.error.code === 'SetLimitExceeded' || 
            data.error.message?.includes('inference limit')) {
          console.log('\n🔴 问题诊断：模型推理限额已用尽');
          console.log('💡 解决方案:');
          console.log('   1. 访问火山方舟控制台的 Model Activation 页面');
          console.log('   2. 调整或关闭 "Safe Experience Mode" 设置');
          console.log('   3. 或者切换到其他仍有额度的模型');
        }
      }
    }
  } catch (error: any) {
    console.log('❌ 网络错误:');
    console.log(`  消息：${error.message}`);
    console.log(`  类型：${error.constructor?.name}`);
    console.log('\n可能原因:');
    console.log('  1. 网络连接问题');
    console.log('  2. SSL 证书验证失败');
    console.log('  3. 防火墙阻止');
  }
}

testNativeFetch().catch(console.error);
