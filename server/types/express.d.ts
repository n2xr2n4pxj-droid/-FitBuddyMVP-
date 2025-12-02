// 擴展 Express 的 Request 接口
// 添加 rawBody 屬性

// 確保這是一個模組文件
export {};

declare module 'express-serve-static-core' {
  interface Request {
    rawBody?: Buffer;
  }
}

