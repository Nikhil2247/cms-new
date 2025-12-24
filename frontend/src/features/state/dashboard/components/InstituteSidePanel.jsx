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
            ? 'bg-primary/10 border-primary/20'
            : 'hover:bg-background-tertiary border-transparent'
        } border`}
      >
        <List.Item.Meta
          avatar={
            <Avatar
              icon={<BankOutlined />}
              className={isSelected ? 'bg-primary text-white' : 'bg-background-tertiary text-text-secondary'}
            />
          }
          title={
            <Text strong className={`block truncate ${isSelected ? 'text-primary' : 'text-text-primary'}`}>
              {institution.name}
            </Text>
          }
          description={
            <div className="flex flex-col">
              <Text className={`text-xs ${isSelected ? 'text-primary/80' : 'text-text-tertiary'}`}>{institution.code}</Text>
              <Text className={`text-xs ${isSelected ? 'text-primary/80' : 'text-text-tertiary'}`}>{institution.city}</Text>
            </div>
          }
        />
        {institution._count?.Student > 0 && (
          <Badge
            count={institution._count.Student}
            className={isSelected ? '[&_.ant-badge-count]:!bg-primary' : '[&_.ant-badge-count]:!bg-text-tertiary'}
            overflowCount={999}
          />
        )}
      </List.Item>
    );
  };

  return (
    <div className="h-full flex flex-col bg-surface border-r border-border">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <Title level={5} className="!mb-3 !text-text-primary">Institutions</Title>
        <Search
          placeholder="Search institutions..."
          prefix={<SearchOutlined className="text-text-tertiary" />}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          allowClear
          className="rounded-lg bg-background border-border"
        />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
        {loading ? (
          <div className="flex justify-center items-center h-32">
            <Spin size="small" />
          </div>
        ) : filteredInstitutions.length === 0 ? (
          <Empty
            description={debouncedSearch ? "No matching institutions" : "No institutions found"}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            className="mt-10"
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
      <div className="p-3 border-t border-border bg-background-tertiary">
        <Text className="text-xs text-text-tertiary">
          Showing {filteredInstitutions.length} of {institutions.length} institutions
        </Text>
      </div>
    </div>
  );
};

export default InstituteSidePanel;
