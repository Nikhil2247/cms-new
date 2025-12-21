import React, { useEffect, useMemo, useState } from 'react';
import { Button, Space, Tag } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import { fetchInstitutions } from '../store/stateSlice';
import DataTable from '../../../components/tables/DataTable';
import { EyeOutlined, EditOutlined } from '@ant-design/icons';
import { getStatusColor } from '../../../utils/format';
import { useNavigate } from 'react-router-dom';

const InstitutionList = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { list, loading, pagination } = useSelector((state) => state.state.institutions);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    dispatch(fetchInstitutions({ page, limit: pageSize }));
  }, [dispatch, page, pageSize]);

  const columns = useMemo(() => [
    {
      title: 'Institution Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      filters: [
        { text: 'Engineering', value: 'ENGINEERING' },
        { text: 'Polytechnic', value: 'POLYTECHNIC' },
      ],
      onFilter: (value, record) => record.type === value,
      render: (type) => type || '-',
    },
    {
      title: 'Students',
      key: 'studentCount',
      render: (_, record) => record?._count?.Student ?? record?.studentCount ?? 0,
      sorter: (a, b) => (a?._count?.Student ?? a?.studentCount ?? 0) - (b?._count?.Student ?? b?.studentCount ?? 0),
    },
    {
      title: 'Faculty',
      key: 'facultyCount',
      render: (_, record) => record?._count?.users ?? record?.facultyCount ?? 0,
      sorter: (a, b) => (a?._count?.users ?? a?.facultyCount ?? 0) - (b?._count?.users ?? b?.facultyCount ?? 0),
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, record) => {
        const status = record?.status || (record?.isActive ? 'ACTIVE' : 'INACTIVE');
        return (
          <Tag color={getStatusColor(status)}>
            {String(status).toUpperCase()}
          </Tag>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/institutions/${record.id}/edit`)}
          >
            View
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => navigate(`/institutions/${record.id}/edit`)}
          >
            Edit
          </Button>
        </Space>
      ),
    },
  ], [navigate]);

  const tablePagination = {
    current: page,
    pageSize,
    total: pagination?.total ?? list?.length ?? 0,
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Institutions</h1>
        <Button type="primary" onClick={() => navigate('/institutions/new')}>Add Institution</Button>
      </div>

      <DataTable
        columns={columns}
        dataSource={list}
        loading={loading}
        pagination={tablePagination}
        onChange={(nextPagination) => {
          const nextPage = nextPagination?.current ?? 1;
          const nextSize = nextPagination?.pageSize ?? pageSize;
          if (nextSize !== pageSize) {
            setPage(1);
            setPageSize(nextSize);
            return;
          }
          setPage(nextPage);
        }}
        rowKey="id"
      />
    </div>
  );
};

export default InstitutionList;