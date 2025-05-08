import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import HomePage from './pages/HomePage';
import AGVDetailPage from './pages/AGVDetailPage';

// 获取根元素
const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('无法找到根元素');

// 创建React根
const root = createRoot(rootElement);

// 渲染应用
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/agv/:id" element={<AGVDetailPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
); 