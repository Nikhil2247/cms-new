import { App } from 'antd';

/**
 * Hook to get context-aware message, notification, and modal APIs from Ant Design.
 * This avoids the warning: "Static function can not consume context like dynamic theme"
 *
 * Usage:
 * const { message, notification, modal } = useMessage();
 * message.success('Done!');
 */
export const useMessage = () => {
  const { message, notification, modal } = App.useApp();
  return { message, notification, modal };
};

export default useMessage;
