// import axios from "axios";
// import { siteConfig } from "@/config/site";

// // const NEXT_BASE_URL =
// //   process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

// const axiosInstance = axios.create({
//   //baseURL: NEXT_BASE_URL + "/api/mangadex", // uncomment this line and above if you want to use built-in proxy
//   baseURL: siteConfig.suicaodex.apiURL,
// });

// export default axiosInstance;

// axios.ts
import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import { setCurrentApiUrl, getCurrentImageProxyUrl, setCurrentImageProxyUrl } from "./utils";

const proxyGroup1 = [
  "https://api2.suicaodex.com",
  "https://api.suicaodex.com",
];

const proxyGroup2 = [
  "https://pr.memaydex.online",
  "https://proxy.bltx.workers.dev",
  "https://clf.suicaodex.com",
];

const proxyList = [
  // process.env.NEXT_PUBLIC_PROXY_URL as string, // pls use your own proxy
  "https://pr.memaydex.online",
  "https://api2.suicaodex.com",
  "https://proxy.bltx.workers.dev",
  "https://api.suicaodex.com",
  "https://clf.suicaodex.com",
];

let lastSuccessfulProxyIndex = 0;
let lastProxySuccessTime = Date.now();
const PROXY_CACHE_DURATION = 60 * 1000; // Cache trong 1 phút

let lastSuccessfulImageProxyIndex = 0;
let lastImageProxySuccessTime = Date.now();

// Tạo axios instance theo baseURL
const createAxiosInstance = (baseURL: string): AxiosInstance => {
  return axios.create({
    baseURL,
    timeout: 5000,
    headers: {
      "Content-Type": "application/json",
    },
  });
};

// Hàm fallback proxy
export const axiosWithProxyFallback = async <T = any>(
  config: AxiosRequestConfig
): Promise<T> => {
  let lastError;

  // Kiểm tra xem có proxy đã thành công gần nhất
  const now = Date.now();
  let startIndex = 0;
  if (now - lastProxySuccessTime < PROXY_CACHE_DURATION) {
    startIndex = lastSuccessfulProxyIndex;
  }

  for (let i = 0; i < proxyList.length; i++) {
    const index = (startIndex + i) % proxyList.length;
    const proxy = proxyList[index];
    const instance = createAxiosInstance(proxy);
    try {
      const response = await instance.request<T>(config);
      // Cập nhật proxy thành công
      lastSuccessfulProxyIndex = index;
      lastProxySuccessTime = Date.now();
      console.info(`[API Success] Using: ${proxy} | Status: ${response.status}`);

      const responseData = response.data as any;
      responseData.__proxy_url = proxy;

      // Set API URL
      setCurrentApiUrl(proxy);

      return responseData;
    } catch (error: any) {
      const status = error.response?.status || "No Response";
      lastError = error;
      console.warn(`[Failed] ${proxy} failed with status: ${status}, trying next...`);
    }
  }
  console.log("All failed");
  throw lastError;
};

// (luôn dùng pr1)
export const axiosInstance = createAxiosInstance(proxyList[0]);

export const initImageProxy = async (): Promise<void> => {
  const prioritizedProxyList = [...proxyGroup1, ...proxyGroup2];

  for (const proxy of prioritizedProxyList) {
    const instance = createAxiosInstance(proxy);

    try {
      await instance.get("/ping", { timeout: 3000 }).catch(() => {
        return instance.get("/", { timeout: 3000 });
      });

      lastSuccessfulImageProxyIndex = prioritizedProxyList.indexOf(proxy);
      lastImageProxySuccessTime = Date.now();
      console.info(`[Image Init] Using: ${proxy}`);

      setCurrentImageProxyUrl(proxy);
      return;
    } catch (error) {
      console.warn(`[Image Init] ${proxy} failed, trying next...`);
    }
  }

  console.warn("[Image Init] All failed, using fallback");
  const fallbackProxy = proxyGroup1[0];
  setCurrentImageProxyUrl(fallbackProxy);
};

export const refreshImageProxy = async (): Promise<string> => {
  await initImageProxy();
  return getCurrentImageProxyUrl();
};

// const data = await axiosWithProxyFallback({ url: "/author?name=abc", method: "get" });
// axiosInstance.get() nếu muốn luôn dùng PR1

