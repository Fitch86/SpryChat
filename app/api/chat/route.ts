import { createOpenAI } from "@ai-sdk/openai";
import { frontendTools } from "@assistant-ui/react-ai-sdk";
import { streamText } from "ai";

export const runtime = "edge";
export const maxDuration = 30;

// 模型分类逻辑（与前端保持一致）
const getModelCategory = (modelId: string) => {
  const id = modelId.toLowerCase();
  
  if (id.includes('dall-e') || id.includes('midjourney') || id.includes('stable-diffusion') ||
      id.includes('flux') || id.includes('imagen') || id.includes('firefly') || id.includes('playground')) {
    const isEdit = id.includes('edit') || id.includes('inpaint') || id.includes('outpaint');
    return {
      category: 'images',
      subcategory: isEdit ? 'edits' : 'generations',
      endpoint: isEdit ? '/images/edits' : '/images/generations'
    };
  }
  
  if (id.includes('whisper') || id.includes('tts') || id.includes('speech') || 
      id.includes('audio') || id.includes('voice')) {
    return {
      category: 'audio',
      endpoint: id.includes('tts') || id.includes('speech') ? '/audio/speech' : '/audio/transcriptions'
    };
  }
  
  if (id.includes('sora') || id.includes('runway') || id.includes('pika') ||
      id.includes('video') || id.includes('gen-2') || id.includes('gen-3')) {
    return {
      category: 'videos',
      endpoint: '/videos/generations'
    };
  }
  
  return {
    category: 'chat',
    endpoint: '/chat/completions'
  };
};

export async function POST(req: Request) {
  const { messages, system, tools } = await req.json();

  // 从headers获取客户端设置
  const headerApiKey = req.headers.get('X-API-Key');
  const headerBaseURL = req.headers.get('X-Base-URL');
  const headerModel = req.headers.get('X-Model');
  const headerTitle = req.headers.get('X-Title') || 'SpryChat';
  const incomingReferer = req.headers.get('referer') || req.headers.get('referrer') || '';
  const incomingOrigin = req.headers.get('origin') || '';
  const siteUrlFallback = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || '';
  const effectiveReferer = incomingReferer || siteUrlFallback || incomingOrigin;

  // 优先使用客户端传递的设置，然后是环境变量
  const finalApiKey = headerApiKey || process.env.OPENROUTE_API_KEY || process.env.OPENAI_API_KEY;
  const finalBaseURL = headerBaseURL || process.env.OPENROUTE_BASE_URL || "https://api.openai.com/v1";
  const finalModel = headerModel || process.env.OPENROUTE_MODEL || "gpt-4o";

  // 获取模型类别和对应的端点
  const modelInfo = getModelCategory(finalModel);

  // 调试日志
  console.log('🚀 API Request Debug:', {
    headerApiKey: headerApiKey ? '***configured***' : 'missing',
    headerBaseURL: headerBaseURL || 'using default',
    headerModel: headerModel || 'using default',
    headerTitle,
    incomingReferer,
    incomingOrigin,
    effectiveReferer,
    finalModel,
    finalBaseURL,
    hasApiKey: !!finalApiKey,
    modelCategory: modelInfo.category,
    modelEndpoint: modelInfo.endpoint
  });
  
  // 额外调试：检查所有headers
  console.log('📋 All request headers:');
  req.headers.forEach((value, key) => {
    if (key.startsWith('x-') || key.toLowerCase().includes('model') || key.toLowerCase().includes('api')) {
      console.log(`  ${key}: ${value}`);
    }
  });

  // 如果没有API密钥，返回错误
  if (!finalApiKey) {
    return new Response(
      JSON.stringify({ error: '请在设置中配置API密钥' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // 对于图像模型，自动调用图像生成 API
    if (modelInfo.category === 'images') {
      console.log('🎨 Image model detected, generating image...');
      
      // 获取最后一条用户消息作为 prompt
      const lastUserMessage = messages.filter((m: any) => m.role === 'user').pop();
      const prompt = typeof lastUserMessage?.content === 'string' 
        ? lastUserMessage.content 
        : lastUserMessage?.content?.[0]?.text || '';

      if (!prompt) {
        return new Response(
          JSON.stringify({ error: '请提供图像描述' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      try {
        // 调用图像生成 API
        const imageResponse = await fetch(`${finalBaseURL}${modelInfo.endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${finalApiKey}`,
          },
          body: JSON.stringify({
            model: finalModel,
            prompt,
            n: 1,
            size: '1024x1024',
          }),
        });

        if (!imageResponse.ok) {
          const errorData = await imageResponse.json().catch(() => ({}));
          console.error('Image generation error:', errorData);
          throw new Error(errorData.error?.message || '图像生成失败');
        }

        const imageResult = await imageResponse.json();
        const imageUrl = imageResult.data?.[0]?.url;

        if (!imageUrl) {
          throw new Error('未能获取图像URL');
        }

        console.log('✅ Image generated:', imageUrl);

        // 构造包含图像的消息
        const imageMessage = `我已经为您生成了图像：\n\n![Generated Image](${imageUrl})`;

        // 创建符合 AI SDK 格式的流式响应
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            // 发送文本块（AI SDK 数据流格式）
            for (const char of imageMessage) {
              // 格式: 0:"字符"\n
              const chunk = `0:${JSON.stringify(char)}\n`;
              controller.enqueue(encoder.encode(chunk));
            }
            controller.close();
          }
        });

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'X-Vercel-AI-Data-Stream': 'v1',
          },
        });
      } catch (imageError: any) {
        console.error('Image generation failed:', imageError);
        return new Response(
          JSON.stringify({ 
            error: imageError.message || '图像生成失败，请检查模型和 API 配置' 
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // 对于其他非聊天模型，返回不支持的错误信息
    if (modelInfo.category !== 'chat') {
      return new Response(
        JSON.stringify({ 
          error: `${modelInfo.category} 模型暂不支持聊天功能`,
          modelCategory: modelInfo.category,
          suggestedEndpoint: modelInfo.endpoint,
          message: `此模型属于 ${modelInfo.category} 类别，需要使用专门的 ${modelInfo.endpoint} 端点`
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 创建OpenRoute提供商实例
    const openroute = createOpenAI({
      apiKey: finalApiKey,
      baseURL: finalBaseURL,
      headers: {
        'X-Title': headerTitle,
        // OpenRouter uses HTTP-Referer to attribute app/source
        ...(effectiveReferer ? { 'HTTP-Referer': effectiveReferer } : {}),
        ...(incomingOrigin ? { 'Origin': incomingOrigin } : {}),
      },
    });

    const result = streamText({
      model: openroute(finalModel),
      messages,
      // forward system prompt and tools from the frontend
      toolCallStreaming: true,
      system,
      tools: {
        ...frontendTools(tools),
      },
      onError: console.log,
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error('API Error:', error);
    return new Response(
      JSON.stringify({ error: 'API调用失败，请检查网络连接和API密钥' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
