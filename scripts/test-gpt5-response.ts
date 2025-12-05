#!/usr/bin/env ts-node
/**
 * Test Script: GPT-5 Response Diagnostic
 *
 * Tests if GPT-5 actually returns content or refuses silently
 */

import OpenAI from 'openai';
import * as dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.error('❌ OPENAI_API_KEY not found in environment');
  process.exit(1);
}

const client = new OpenAI({
  apiKey: apiKey,
  baseURL: 'https://api.openai.com/v1',
});

async function testSimpleRequest() {
  console.log('\n🧪 Test 1: Ultra-simple request to GPT-5');
  console.log('=' .repeat(60));

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-5',
      messages: [
        { role: 'user', content: 'Hello, please respond with a simple greeting.' }
      ],
      max_completion_tokens: 100,
    });

    console.log('✅ API call succeeded');
    console.log('\n📊 Response Details:');
    console.log('Model:', response.model);
    console.log('Choices:', response.choices.length);

    const choice = response.choices[0];
    console.log('\n📝 Choice 0:');
    console.log('finish_reason:', choice.finish_reason);
    console.log('message.role:', choice.message?.role);
    console.log('message.content:', choice.message?.content);
    console.log('message.refusal:', (choice.message as any)?.refusal || 'none');
    console.log('content length:', choice.message?.content?.length || 0);

    console.log('\n🔍 Full Response (JSON):');
    console.log(JSON.stringify(response, null, 2));

  } catch (error: any) {
    console.error('❌ API call failed:', error.message);
    console.error('Status:', error.status);
    console.error('Type:', error.type);
  }
}

async function testStreamingRequest() {
  console.log('\n\n🧪 Test 2: Streaming request to GPT-5');
  console.log('=' .repeat(60));

  try {
    const stream = await client.chat.completions.create({
      model: 'gpt-5',
      messages: [
        { role: 'user', content: 'Count from 1 to 5.' }
      ],
      max_completion_tokens: 100,
      stream: true,
    });

    console.log('✅ Stream started');

    let chunkCount = 0;
    let totalContent = '';
    let finishReason = '';

    for await (const chunk of stream) {
      chunkCount++;
      const choice = chunk.choices?.[0];

      if (choice?.delta?.content) {
        totalContent += choice.delta.content;
        process.stdout.write(choice.delta.content);
      }

      if (choice?.finish_reason) {
        finishReason = choice.finish_reason;
      }
    }

    console.log('\n\n📊 Stream Summary:');
    console.log('Total chunks:', chunkCount);
    console.log('Total content length:', totalContent.length);
    console.log('Finish reason:', finishReason);
    console.log('\n📝 Complete content:');
    console.log(totalContent);

  } catch (error: any) {
    console.error('❌ Stream failed:', error.message);
    console.error('Status:', error.status);
    console.error('Type:', error.type);
  }
}

async function testWithTools() {
  console.log('\n\n🧪 Test 3: Request WITH tools (like grokinou)');
  console.log('=' .repeat(60));

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-5',
      messages: [
        { role: 'user', content: 'What is 2+2? Just tell me the answer.' }
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'test_tool',
            description: 'A test tool',
            parameters: {
              type: 'object',
              properties: {
                value: { type: 'string' }
              }
            }
          }
        }
      ],
      max_completion_tokens: 100,
    });

    console.log('✅ API call with tools succeeded');

    const choice = response.choices[0];
    console.log('\n📊 Response:');
    console.log('finish_reason:', choice.finish_reason);
    console.log('message.content:', choice.message?.content);
    console.log('message.tool_calls:', choice.message?.tool_calls?.length || 0);
    console.log('content length:', choice.message?.content?.length || 0);

  } catch (error: any) {
    console.error('❌ API call failed:', error.message);
  }
}

async function main() {
  console.log('🔬 GPT-5 Response Diagnostic Tool');
  console.log('Testing if GPT-5 actually returns content...\n');

  await testSimpleRequest();
  await testStreamingRequest();
  await testWithTools();

  console.log('\n\n✅ All tests completed');
  console.log('Check output above to see if GPT-5 is responding');
}

main().catch(console.error);
