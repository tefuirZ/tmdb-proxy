// functions/tmdb-proxy.js

// 引入 node-fetch 库，用于在 Node.js 环境中发起 HTTP 请求
const fetch = require('node-fetch');

/**
 * Netlify Function 的主入口点。
 * 这个函数将接收所有指向其路径的请求，并将其转发到 TMDb API。
 *
 * @param {object} event - 包含请求信息的事件对象 (path, queryStringParameters, etc.)。
 * @param {object} context - 包含运行时信息的上下文对象。
 * @returns {Promise<object>} - 包含 HTTP 状态码、头信息和响应体的 Promise 对象。
 */
exports.handler = async (event, context) => {
    // 设置响应头，允许所有来源的跨域请求 (CORS)。
    // 在生产环境中，为了安全，你可能希望将 'Access-Control-Allow-Origin' 限制为你的前端域名。
    const headers = {
        'Access-Control-Allow-Origin': '*', // 允许任何域名访问
        'Access-Control-Allow-Headers': 'Content-Type', // 允许 Content-Type 头
        'Content-Type': 'application/json' // 响应内容类型为 JSON
    };

    try {
        // 从 Netlify 的环境变量中获取 TMDb API 密钥。
        // 务必在 Netlify UI 中设置名为 TMDB_API_KEY 的环境变量！
        const TMDB_API_KEY = process.env.TMDB_API_KEY;

        // 如果 API 密钥未设置，则返回服务器配置错误。
        if (!TMDB_API_KEY) {
            console.error("TMDB_API_KEY is not set in environment variables.");
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Server configuration error: TMDb API key missing.' }),
            };
        }

        // 从事件对象中解构出请求路径和查询参数。
        const { path, queryStringParameters } = event;

        // TMDb API 的基础 URL。
        const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

        // 解析出需要转发到 TMDb 的实际 API 路径。
        // Netlify Function 的路径通常是 '/.netlify/functions/你的函数名'。
        // 我们需要移除这个前缀，只保留 TMDb 相关的路径部分。
        // 例如，如果请求路径是 '/.netlify/functions/tmdb-proxy/movie/popular'，
        // 那么 tmdbRelativePath 将是 '/movie/popular'。
        const tmdbRelativePath = path.replace('/.netlify/functions/tmdb-proxy', '');

        // 确保最终的 TMDb 路径以 '/' 开头，以符合 TMDb API 的规范。
        const finalTmdbPath = tmdbRelativePath.startsWith('/') ? tmdbRelativePath : `/${tmdbRelativePath}`;

        // 使用 URLSearchParams 来构建 TMDb API 的查询字符串。
        // 它会包含所有原始请求的查询参数，并自动添加你的 TMDb API 密钥。
        const params = new URLSearchParams(queryStringParameters);
        params.append('api_key', TMDB_API_KEY); // 将 API 密钥添加到 TMDb 请求中

        // 构造完整的 TMDb API 请求 URL。
        const tmdbUrl = `${TMDB_BASE_URL}${finalTmdbPath}?${params.toString()}`;

        console.log(`Proxying request to TMDb: ${tmdbUrl}`); // 在 Netlify 日志中记录转发的 URL

        // 向 TMDb 官方 API 发起 HTTP GET 请求。
        const tmdbResponse = await fetch(tmdbUrl);

        // 检查 TMDb API 的响应状态码。
        // 如果 TMDb 返回了非 2xx 的状态码（如 404, 500），则将其转发给客户端。
        if (!tmdbResponse.ok) {
            const errorText = await tmdbResponse.text(); // 获取 TMDb 返回的错误信息
            console.error(`TMDb API returned an error: ${tmdbResponse.status} - ${errorText}`);
            return {
                statusCode: tmdbResponse.status, // 转发 TMDb 的状态码
                headers,
                body: JSON.stringify({ error: `TMDb API error: ${tmdbResponse.statusText}`, details: errorText }),
            };
        }

        // 解析 TMDb 返回的 JSON 数据。
        const data = await tmdbResponse.json();

        // 将 TMDb 返回的数据以 JSON 格式返回给前端客户端。
        return {
            statusCode: 200, // 成功状态码
            headers,
            body: JSON.stringify(data),
        };

    } catch (error) {
        // 捕获在函数执行过程中发生的任何错误（例如网络问题、JSON 解析失败等）。
        console.error('Error in Netlify Function:', error);
        return {
            statusCode: 500, // 内部服务器错误
            headers,
            body: JSON.stringify({ error: 'Internal Server Error', details: error.message }),
        };
    }
};