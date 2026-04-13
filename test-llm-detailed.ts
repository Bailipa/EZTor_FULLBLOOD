/**
 * LLM API 详细错误诊断脚本
 */

import OpenAI from 'openai';

async function testDetailedError() {
  const apiKey = 'bef4394a-b5e8-4002-9bf0-82ee31f5fae2';
  const baseUrl = 'https://ark.cn-beijing.volces.com/api/v3';
  const model = 'deepseek-v3-250324';
  
  console.log('测试配置:');
  console.log(`  API Key: ${apiKey.substring(0, 8)}...`);
  console.log(`  Base URL: ${baseUrl}`);
  console.log(`  Model: ${model}`);
  console.log('');
  
  const client = new OpenAI({
    apiKey,
    baseURL: baseUrl,
    timeout: 30000,
  });
  
  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'user', content: 'Hello' }
      ],
      max_tokens: 5,
    });
    
    console.log('✅ 成功!');
    console.log('响应:', response.choices[0]?.message?.content);
  } catch (error: any) {
    console.log('❌ 错误详情:');
    console.log(`  错误消息：${error.message}`);
    console.log(`  状态码：${error.status}`);
    console.log(`  错误类型：${error.constructor?.name}`);
    console.log(`  错误代码：${error.code}`);
    console.log('');
    
    // 尝试解析响应体
    if (error.response) {
      console.log('响应详情:');
      console.log(`  状态：${error.response.status}`);
      console.log(`  数据：${JSON.stringify(error.response.data, null, 2)}`);
      console.log('');
    }
    
    // 错误分类
    console.log('错误分类:');
    
    if (error.status === 429 || error.response?.status === 429) {
      console.log('  🔴 配额限制错误 (429 Too Many Requests)');
    }
    
    if (error.message?.includes('SetLimitExceeded') || 
        error.message?.includes('inference limit') ||
        error.message?.includes('TooManyRequests')) {
      console.log('  🔴 模型推理限额已用尽');
      console.log('  💡 解决方案：需要访问 Model Activation 页面调整 "Safe Experience Mode" 设置');
    }
    
    if (error.message?.includes('connection')) {
      console.log('  🔴 连接错误');
    }
    
    if (error.message?.includes('quota')) {
      console.log('  🔴 配额错误');
    }
    
    console.log('');
    console.log('完整错误堆栈:');
    console.log(error.stack);
  }
}

testDetailedError().catch(console.error);
