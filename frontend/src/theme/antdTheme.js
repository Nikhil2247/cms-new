import { theme } from 'antd';

const { defaultAlgorithm, darkAlgorithm } = theme;

export const lightTheme = {
  token: {
    colorPrimary: '#3b82f6',
    fontFamily: "'Inter', system-ui, sans-serif",
    borderRadius: 8,
  },
  algorithm: defaultAlgorithm,
};

export const darkTheme = {
  token: {
    colorPrimary: '#60a5fa',
    colorBgContainer: '#1e293b',
    colorBgElevated: '#1e293b',
    colorBgLayout: '#0f172a',
    colorBorder: '#475569',
    colorBorderSecondary: '#334155',
    fontFamily: "'Inter', system-ui, sans-serif",
    borderRadius: 8,
  },
  algorithm: darkAlgorithm,
  components: {
    Card: {
      colorBgContainer: '#1e293b',
    },
    Table: {
      colorBgContainer: '#1e293b',
    },
    Modal: {
      contentBg: '#1e293b',
      headerBg: '#1e293b',
    },
    Drawer: {
      colorBgElevated: '#1e293b',
    },
  },
};
