import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout } from 'antd';
import HomePage from './pages/HomePage';
import AGVDetailPage from './pages/AGVDetailPage';
import './App.css';

const { Header, Content, Footer } = Layout;

const App: React.FC = () => {
  return (
    <Layout className="layout">
      <Header style={{ display: 'flex', alignItems: 'center' }}>
        <div className="logo" />
        <h1 style={{ color: 'white', margin: 0 }}>AGV ROS监控系统</h1>
      </Header>
      <Content style={{ padding: '0 50px' }}>
        <div className="site-layout-content">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/agv/:id" element={<AGVDetailPage />} />
          </Routes>
        </div>
      </Content>
      <Footer style={{ textAlign: 'center' }}>AGV ROS监控系统 ©2023</Footer>
    </Layout>
  );
};

export default App; 