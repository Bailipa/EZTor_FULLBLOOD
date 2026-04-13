/**
 * LLM API 连接测试脚本
 * 用于测试大模型 API 的连接状态和切换机制
 */

// 禁用 SSL 验证（仅用于测试环境）
if (typeof process !== 'undefined' && process.env) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

import OpenAI from 'openai';
import prisma from './src/lib/prisma';
import { Prisma } from '@prisma/client';

interface TestResult {
  providerName: string;
  providerId: string;
  baseUrl: string;
  model: string;
  success: boolean;
  error?: string;
  responseTime?: number;
  details?: any;
}

async function testProviderConnection(
  providerId: string,
  name: string,
  apiKey: string,
  baseUrl: string,
  model: string
): Promise<TestResult> {
  console.log(`\n🔍 测试提供商：${name}`);
  console.log(`   Base URL: ${baseUrl}`);
  console.log(`   Model: ${model}`);
  
  const startTime = Date.now();
  
  try {
    // Normalize base URL (remove trailing /chat/completions)
    const normalizedBaseUrl = baseUrl.replace(/\/chat\/completions$/, '').replace(/\/+$/, '');
    console.log(`   Normalized URL: ${normalizedBaseUrl}`);
    
    const client = new OpenAI({
      apiKey,
      baseURL: normalizedBaseUrl,
      // 禁用超时以便调试
      timeout: 30000,
    });
    
    // 简单的测试请求
    const response = await client.chat.completions.create({
      model: model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Reply with "OK" only.' }
      ],
      max_tokens: 10,
    });
    
    const responseTime = Date.now() - startTime;
    const result: TestResult = {
      providerName: name,
      providerId,
      baseUrl: normalizedBaseUrl,
      model: model || 'gpt-4o-mini',
      success: true,
      responseTime,
      details: {
        choices: response.choices?.[0]?.message?.content,
        usage: response.usage,
      }
    };
    
    console.log(`✅ 成功！响应时间：${responseTime}ms`);
    console.log(`   响应内容：${response.choices?.[0]?.message?.content}`);
    
    return result;
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    const result: TestResult = {
      providerName: name,
      providerId,
      baseUrl,
      model: model || 'gpt-4o-mini',
      success: false,
      error: error?.message || 'Unknown error',
      responseTime,
      details: {
        status: error?.status,
        code: error?.code,
        type: error?.constructor?.name,
      }
    };
    
    console.log(`❌ 失败！错误：${error?.message}`);
    console.log(`   状态码：${error?.status}`);
    console.log(`   错误代码：${error?.code}`);
    console.log(`   错误类型：${error?.constructor?.name}`);
    
    // 详细的错误分类
    if (error?.message?.includes('connection')) {
      console.log(`   🔴 连接错误：可能是网络问题或防火墙阻止`);
    }
    if (error?.message?.includes('timeout')) {
      console.log(`   🔴 超时错误：服务器响应太慢或网络不稳定`);
    }
    if (error?.message?.includes('SSL') || error?.message?.includes('certificate')) {
      console.log(`   🔴 SSL 证书错误：可能是 HTTPS 证书验证失败`);
    }
    if (error?.message?.includes('getaddrinfo')) {
      console.log(`   🔴 DNS 错误：无法解析域名`);
    }
    if (error?.message?.includes('ECONNREFUSED')) {
      console.log(`   🔴 连接被拒绝：服务器可能未运行或端口被阻止`);
    }
    if (error?.message?.includes('ENOTFOUND')) {
      console.log(`   🔴 域名未找到：Base URL 可能不正确`);
    }
    if (error?.status === 401) {
      console.log(`   🔴 认证失败：API Key 可能无效`);
    }
    if (error?.status === 429) {
      console.log(`   🔴 请求限制：API 配额已用尽`);
    }
    
    return result;
  }
}

async function testLegacyProvider(): Promise<TestResult | null> {
  const apiKey = process.env.LLM_API_KEY;
  const baseUrl = process.env.LLM_API_URL;
  const model = process.env.LLM_MODEL || 'gpt-4o-mini';
  
  if (!apiKey || !baseUrl) {
    console.log('\n⚠️  未配置环境变量 LLM_API_KEY 或 LLM_API_URL');
    return null;
  }
  
  return testProviderConnection(
    'legacy',
    'Legacy (环境变量)',
    apiKey,
    baseUrl,
    model
  );
}

async function getProvidersFromDatabase() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS LlmApiProvider (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL UNIQUE,
        apiKey TEXT NOT NULL,
        baseUrl TEXT NOT NULL DEFAULT 'https://api.openai.com/v1',
        model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
        priority INTEGER NOT NULL DEFAULT 0,
        isActive BOOLEAN NOT NULL DEFAULT 1,
        quotaRemaining INTEGER,
        quotaUsed INTEGER NOT NULL DEFAULT 0,
        lastUsedAt DATETIME,
        lastError TEXT,
        lastErrorAt DATETIME,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    const providers = await prisma.$queryRaw<any[]>(
      Prisma.sql`
        SELECT
          id, name, apiKey, baseUrl, model, priority, isActive,
          quotaRemaining, quotaUsed, lastUsedAt, lastError, lastErrorAt,
          createdAt, updatedAt
        FROM LlmApiProvider
        WHERE isActive = 1
        ORDER BY priority ASC, createdAt ASC
      `
    );
    
    return providers;
  } catch (error) {
    console.error('数据库查询失败:', error);
    return [];
  }
}

async function main() {
  console.log('='.repeat(80));
  console.log('🚀 LLM API 连接测试脚本');
  console.log('='.repeat(80));
  console.log(`开始时间：${new Date().toLocaleString('zh-CN')}`);
  console.log('');
  
  const results: TestResult[] = [];
  
  // 1. 测试数据库中的提供商
  console.log('\n📊 步骤 1: 从数据库加载提供商配置');
  const dbProviders = await getProvidersFromDatabase();
  
  if (dbProviders.length === 0) {
    console.log('   ⚠️  数据库中没有活跃的提供商配置');
  } else {
    console.log(`   找到 ${dbProviders.length} 个活跃的提供商:`);
    dbProviders.forEach(p => {
      console.log(`   - ${p.name} (优先级：${p.priority}, 剩余：${p.quotaRemaining === null ? '∞' : p.quotaRemaining})`);
    });
  }
  
  // 测试每个数据库提供商
  for (const provider of dbProviders) {
    const result = await testProviderConnection(
      provider.id,
      provider.name,
      provider.apiKey,
      provider.baseUrl,
      provider.model
    );
    results.push(result);
    
    // 在测试之间等待一小段时间
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // 2. 测试环境变量配置
  console.log('\n📊 步骤 2: 测试环境变量配置');
  const legacyResult = await testLegacyProvider();
  if (legacyResult) {
    results.push(legacyResult);
  }
  
  // 3. 总结结果
  console.log('\n' + '='.repeat(80));
  console.log('📈 测试结果总结');
  console.log('='.repeat(80));
  
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  
  console.log(`\n总计：${results.length} 个提供商`);
  console.log(`✅ 成功：${successCount}`);
  console.log(`❌ 失败：${failCount}`);
  
  if (results.length > 0) {
    console.log('\n详细结果:');
    results.forEach((r, index) => {
      console.log(`\n${index + 1}. ${r.providerName} (${r.providerId})`);
      console.log(`   状态：${r.success ? '✅ 成功' : '❌ 失败'}`);
      if (r.success) {
        console.log(`   响应时间：${r.responseTime}ms`);
      } else {
        console.log(`   错误：${r.error}`);
        console.log(`   响应时间：${r.responseTime}ms`);
      }
    });
  }
  
  // 4. 分析和建议
  console.log('\n' + '='.repeat(80));
  console.log('💡 分析和建议');
  console.log('='.repeat(80));
  
  if (successCount === 0 && failCount > 0) {
    console.log('\n⚠️  所有提供商连接失败！');
    console.log('\n可能的问题:');
    console.log('1. 网络连接问题 - 检查是否可以访问外网');
    console.log('2. SSL 证书验证问题 - 尝试在 Base URL 中使用正确的 HTTPS 证书');
    console.log('3. 防火墙阻止 - 检查系统防火墙设置');
    console.log('4. API Key 失效 - 验证所有 API Key 是否有效');
    console.log('5. Base URL 配置错误 - 确认 Base URL 格式正确（应包含 /v1）');
    
    // 检查是否有 SSL 相关错误
    const sslErrors = results.filter(r => 
      r.error?.includes('SSL') || 
      r.error?.includes('certificate') ||
      r.error?.includes('getaddrinfo')
    );
    
    if (sslErrors.length > 0) {
      console.log('\n🔒 SSL/证书相关错误:');
      sslErrors.forEach(r => {
        console.log(`   - ${r.providerName}: ${r.error}`);
      });
      console.log('\n建议尝试:');
      console.log('   1. 在 macOS 钥匙串中信任相关证书');
      console.log('   2. 检查系统时间是否正确');
      console.log('   3. 尝试在 Base URL 中明确指定 https://');
    }
  } else if (successCount > 0 && failCount > 0) {
    console.log('\n⚠️  部分提供商连接失败');
    console.log('建议:');
    console.log('1. 检查失败提供商的配置是否正确');
    console.log('2. 验证失败提供商的 API Key 是否有效');
    console.log('3. 确认失败提供商的网络连接是否正常');
  } else {
    console.log('\n✅ 所有提供商连接正常！');
  }
  
  console.log('\n' + '='.repeat(80));
  console.log(`测试完成时间：${new Date().toLocaleString('zh-CN')}`);
  console.log('='.repeat(80));
  
  // 退出
  process.exit(successCount > 0 ? 0 : 1);
}

// 运行测试
main().catch(console.error);
