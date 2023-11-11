import { Configuration, OpenAIApi } from "openai";
import { Message } from "../messages/messages";
import { postRequest } from "../httpclient/httpclient";

const configuration = new Configuration({
  apiKey: "sk-laixiao",
  basePath: "https://allsite.jxit114.xyz/api.openai.com/v1"
});
const openai = new OpenAIApi(configuration);
export async function getChatResponse(messages: Message[]) {
  delete configuration.baseOptions.headers["User-Agent"];
  const { data } = await openai.createChatCompletion({
    model: "gpt-3.5-turbo",
    messages: messages,
  });

  const [aiRes] = data.choices;
  const message = aiRes.message?.content || "我想买迪奥口红手表";

  return message;
}

export async function getChatResponseStream(messages: Message[], apiKey: string) {
  if (!apiKey) {
    throw new Error("Invalid API Key");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    headers: headers,
    method: "POST",
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: messages,
      stream: true,
      max_tokens: 200,
    }),
  });

  const reader = res.body?.getReader();
  if (res.status !== 200 || !reader) {
    throw new Error("Something went wrong");
  }

  const stream = new ReadableStream({
    async start(controller: ReadableStreamDefaultController) {
      const decoder = new TextDecoder("utf-8");
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const data = decoder.decode(value);
          const chunks = data
            .split("data:")
            .filter((val) => !!val && val.trim() !== "[DONE]");
          for (const chunk of chunks) {
            const json = JSON.parse(chunk);
            const messagePiece = json.choices[0].delta.content;
            if (!!messagePiece) {
              controller.enqueue(messagePiece);
            }
          }
        }
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
        controller.close();
      }
    },
  });

  return stream;
}


export async function chat(
  message: string,
  you_name: string
) {

  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  const body = {
    query: message,
    you_name: you_name
  };

  const chatRes = await postRequest("/chatbot/chat", headers, body);
  if (chatRes.code !== '200') {
    throw new Error("Something went wrong");
  }

  return chatRes.response;
}


