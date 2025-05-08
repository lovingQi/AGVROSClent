// 类型声明文件，用于临时解决类型问题

// React模块声明
declare module 'react' {
  export default any;
  export type FC<P = {}> = React.FunctionComponent<P>;
  export const useState: <T>(initialState: T | (() => T)) => [T, (newState: T | ((prevState: T) => T)) => void];
  export const useEffect: (effect: () => void | (() => void), deps?: any[]) => void;
}

declare module 'react-dom/client' {
  export const createRoot: any;
}

declare module 'react-router-dom' {
  export const BrowserRouter: any;
  export const Routes: any;
  export const Route: any;
  export const Link: any;
  export const useParams: <T extends Record<string, string>>() => T;
  export default any;
}

declare module 'antd' {
  export const Layout: any;
  export const Card: any;
  export const Row: any;
  export const Col: any;
  export const Badge: any;
  export const Spin: any;
  export const Empty: any;
  export const Tabs: any;
  export const Button: any;
  export const Table: any;
  export const Typography: any;
  export const Space: any;
  export const Alert: any;
  export const Tag: any;
}

declare module '@ant-design/icons' {
  export const CarOutlined: any;
  export const ArrowLeftOutlined: any;
  export const ReloadOutlined: any;
}

// 修改roslib模块声明
declare module 'roslib' {
  // 定义Ros类
  class Ros {
    constructor(options: { url: string });
    on(event: string, callback: any): void;
    close(): void;
    getTopics(callback: any, errorCallback: any): void;
  }

  // 定义Topic类
  class Topic {
    constructor(options: { ros: Ros, name: string, messageType: string });
    subscribe(callback: any): void;
    unsubscribe(): void;
  }
  
  export { Ros, Topic };
}

declare module '../utils/RosConnection' {
  export default any;
}

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
} 