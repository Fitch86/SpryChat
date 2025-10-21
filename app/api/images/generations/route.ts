export const runtime = "edge";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { prompt, model, n = 1, size = "1024x1024" } = body;

    // 从headers获取客户端设置
    const headerApiKey = req.headers.get('X-API-Key');
    const headerBaseURL = req.headers.get('X-Base-URL');
    const headerModel = req.headers.get('X-Model');

    // 优先使用客户端传递的设置，然后是环境变量
    const finalApiKey = headerApiKey || process.env.OPENROUTE_API_KEY || process.env.OPENAI_API_KEY;
    const finalBaseURL = headerBaseURL || process.env.OPENROUTE_BASE_URL || "https://api.openai.com/v1";
    const finalModel = model || headerModel || "dall-e-3";

    console.log('🎨 Image Generation Request:', {
      model: finalModel,
      prompt: prompt?.substring(0, 50) + '...',
      n,
      size,
      hasApiKey: !!finalApiKey,
      baseURL: finalBaseURL
    });

    if (!finalApiKey) {
      return new Response(
        JSON.stringify({ error: '请在设置中配置API密钥' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: '请提供图像描述' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 调用图像生成API
    const response = await fetch(`${finalBaseURL}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${finalApiKey}`,
      },
      body: JSON.stringify({
        model: finalModel,
        prompt,
        n,
        size,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Image generation API error:', errorData);
      return new Response(
        JSON.stringify({ 
          error: errorData.error?.message || '图像生成失败',
          details: errorData 
        }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = await response.json();
    console.log('✅ Image generation successful:', result.data?.length || 0, 'images');

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Image generation error:', error);
    return new Response(
      JSON.stringify({ 
        error: '图像生成失败，请检查网络连接和API密钥',
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
