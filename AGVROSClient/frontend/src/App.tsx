import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { Layout } from 'antd';
import HomePage from './pages/HomePage';
import AGVDetailPage from './pages/AGVDetailPage';
import CameraImagePage from './pages/CameraImagePage';
import ParamsViewer from './components/ParamsViewer';
import './App.css';

const { Header, Content, Footer } = Layout;

const App: React.FC = () => {
  return (
    <Layout className="layout">
      <Header style={{ display: 'flex', alignItems: 'center', padding: '0 20px' }}>
        <div className="logo" />
        <nav style={{ display: 'flex', gap: '20px' }}>
          <Link to="/" style={{ color: 'white' }}>首页</Link>
          <Link to="/params" style={{ color: 'white' }}>参数配置</Link>
        </nav>
      </Header>
      <Content style={{ padding: '0 50px' }}>
        <div className="site-layout-content">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/agv/:id" element={<AGVDetailPage />} />
            <Route path="/agv/:agvId/camera" element={<CameraImagePage />} />
            <Route path="/params" element={<ParamsViewer />} />
          </Routes>
        </div>
      </Content>
      <Footer style={{ textAlign: 'center' }}>AGV ROS监控系统 ©2023</Footer>
    </Layout>
  );
};

export default App; 