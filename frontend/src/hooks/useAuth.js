import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { logout as logoutAction } from '../features/auth/store/authSlice';
import { tokenStorage } from '../utils/tokenManager';
import { persistor } from '../app/store/index';

// Backend role constants
const ROLES = {
  STATE: 'STATE_DIRECTORATE',
  PRINCIPAL: 'PRINCIPAL',
  FACULTY: ['FACULTY', 'TEACHER', 'FACULTY_SUPERVISOR'],
  STUDENT: 'STUDENT',
  INDUSTRY: ['INDUSTRY', 'INDUSTRY_PARTNER', 'INDUSTRY_SUPERVISOR'],
};

export const useAuth = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, isAuthenticated, loading } = useSelector((state) => state.auth);

  const logout = async () => {
    // Dispatch Redux logout action (clears state and tokens via tokenStorage)
    dispatch(logoutAction());

    // Purge persisted Redux state
    if (persistor) {
      await persistor.purge();
    }

    // Navigate to login
    navigate('/login', { replace: true });
  };

  const hasRole = (role) => {
    return user?.role === role;
  };

  const hasAnyRole = (roles) => {
    return roles.includes(user?.role);
  };

  const hasPermission = (permission) => {
    return user?.permissions?.includes(permission);
  };

  const isState = user?.role === ROLES.STATE;
  const isPrincipal = user?.role === ROLES.PRINCIPAL;
  const isFaculty = ROLES.FACULTY.includes(user?.role);
  const isStudent = user?.role === ROLES.STUDENT;
  const isIndustry = ROLES.INDUSTRY.includes(user?.role);

  return {
    user,
    isAuthenticated,
    loading,
    logout,
    hasRole,
    hasAnyRole,
    hasPermission,
    isState,
    isPrincipal,
    isFaculty,
    isStudent,
    isIndustry,
  };
};

export default useAuth;
