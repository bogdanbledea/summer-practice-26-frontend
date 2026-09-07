import axios from "axios";

import { API_URL } from "./config";

const axiosInstance = axios.create({
  baseURL: API_URL,
});

// implement interceptors for request and response to refresh the token in case of 401, and then retry the original request
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response.status === 401) {
      try {
        const response = await axios.post(`${API_URL}/auth/refresh`, {
          refreshToken: localStorage.getItem("refreshToken"),
        });
        localStorage.setItem("accessToken", response.data.accessToken);
        localStorage.setItem("refreshToken", response.data.refreshToken);
        error.config.headers.Authorization = `Bearer ${response.data.accessToken}`;
        return axiosInstance(error.config);
      } catch (refreshError) {
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  },
);

// implement interceptors for request to attach the token to each request
axiosInstance.interceptors.request.use(
  (config) => {
    const accessToken = localStorage.getItem("accessToken");
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

export default axiosInstance;
