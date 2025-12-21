import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Input, List, Avatar, Typography, Spin, Empty, Badge } from 'antd';
import { SearchOutlined, BankOutlined } from '@ant-design/icons';
import {
  fetchInstitutions,
  selectInstitutions,
  selectInstitutionsLoading,
  setSelectedInstitute,
  selectSelectedInstitute,
} from '../../store/stateSlice';

const { Text, Title } = Typography;
const { Search } = Input;

const InstituteSidePanel = ({ onSelectInstitute }) => {
  const dispatch = useDispatch();
  const institutions = useSelector(selectInstitutions);
  const loading = useSelector(selectInstitutionsLoading);
  const selectedInstitute = useSelector(selectSelectedInstitute);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Only fetch if no institutions loaded (parent may have already fetched)
  useEffect(() => {
    if (institutions.length === 0 && !loading) {
      dispatch(fetchInstitutions({ limit: 100 }));
    }
  }, [dispatch, institutions.length, loading]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Filter institutions based on search
  const filteredInstitutions = useMemo(() => {
    if (!debouncedSearch) return institutions;
    const search = debouncedSearch.toLowerCase();
    return institutions.filter(inst =>
      inst.name?.toLowerCase().includes(search) ||
      inst.code?.toLowerCase().includes(search) ||
      inst.city?.toLowerCase().includes(search)
    );
  }, [institutions, debouncedSearch]);

  const handleSelect = useCallback((institution) => {
    dispatch(setSelectedInstitute(institution.id));
    onSelectInstitute?.(institution);
  }, [dispatch, onSelectInstitute]);

  // Render list item
  const renderItem = (institution) => {
    const isSelected = selectedInstitute?.id === institution.id;
    return (
      <List.Item
        key={institution.id}
        onClick={() => handleSelect(institution)}
        className={`cursor-pointer transition-all duration-200 rounded-lg mb-1 px-3 py-2 ${
          isSelected
            ? 'bg-blue-50'
            : 'hover:bg-slate-50'
        }`}
      >
        <List.Item.Meta
          avatar={
            <Avatar
              icon={<BankOutlined />}
              className={isSelected ? 'bg-blue-600' : 'bg-slate-200 text-slate-600'}
            />
          }
          title={
            <Text strong className={isSelected ? 'text-blue-700' : 'text-slate-900'}>
              {institution.name}
            </Text>
          }
          description={
            <div className="flex flex-col">
              <Text className={`text-xs ${isSelected ? 'text-blue-500' : 'text-slate-500'}`}>{institution.code}</Text>
              <Text className={`text-xs ${isSelected ? 'text-blue-500' : 'text-slate-500'}`}>{institution.city}</Text>
            </div>
          }
        />
        {institution._count?.Student > 0 && (
          <Badge
            count={institution._count.Student}
            style={{ backgroundColor: isSelected ? '#2563eb' : '#94a3b8' }}
            overflowCount={999}
          />
        )}
      </List.Item>
    );
  };

  return (
    <div className="h-full flex flex-col bg-white border-r border-slate-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-200">
        <Title level={5} className="!mb-3 !text-slate-900">Institutions</Title>
        <Search
          placeholder="Search institutions..."
          prefix={<SearchOutlined className="text-slate-400" />}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          allowClear
          className="rounded-lg"
        />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex justify-center items-center h-32">
            <Spin size="small" />
          </div>
        ) : filteredInstitutions.length === 0 ? (
          <Empty
            description={debouncedSearch ? "No matching institutions" : "No institutions found"}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <List
            dataSource={filteredInstitutions}
            renderItem={renderItem}
            split={false}
          />
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-slate-200 bg-slate-50">
        <Text className="text-xs text-slate-600">
          Showing {filteredInstitutions.length} of {institutions.length} institutions
        </Text>
      </div>
    </div>
  );
};

export default InstituteSidePanel;
