// src/pages/faculty/AssignedStudents.jsx
import React, { useEffect, useMemo, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Table, Typography, Card, Tag, Spin, Empty, Alert, Button } from "antd";
import { PhoneOutlined, MailOutlined, ReloadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import {
  fetchAssignedStudents,
  selectStudents,
} from "../store/facultySlice";

const { Title, Text } = Typography;

export default function AssignedStudents() {
  const dispatch = useDispatch();
  const studentsState = useSelector(selectStudents);

  // Extract data from state
  const students = studentsState?.list || [];
  const loading = studentsState?.loading || false;
  const error = studentsState?.error || null;

  // Fetch students on mount
  useEffect(() => {
    dispatch(fetchAssignedStudents());
  }, [dispatch]);

  // Force refresh function
  const forceRefresh = useCallback(() => {
    dispatch(fetchAssignedStudents({ forceRefresh: true }));
  }, [dispatch]);

  // Safely process students data
  const safeStudents = useMemo(() => {
    if (!Array.isArray(students)) {
      console.warn("Students data is not an array:", students);
      return [];
    }
    return students;
  }, [students]);

  /* ------------------------------------------------------------------ */
  /*  Column helpers                                                    */
  /* ------------------------------------------------------------------ */
  const statusColor = (app) => {
    if (app.hasJoined || app.status === "COMPLETED") return "green";
    if (app.status === "REJECTED") return "red";
    if (app.status === "UNDER_REVIEW") return "orange";
    return "blue";
  };

  /* ------------------------------------------------------------------ */
  /*  Table columns                                                     */
  /* ------------------------------------------------------------------ */
  const columns = [
    {
      title: "Student",
      key: "student",
      width: "28%",
      render: (_, r) => (
        <div>
          <Text strong className="text-blue-600">
            {r.student?.name || "N/A"}
          </Text>
          <Text className="text-gray-500 block text-sm">
            Roll No: {r.student?.rollNumber || "N/A"}
          </Text>
          <Text className="text-gray-500 block text-sm">
            {r.student?.branchName || "N/A"}
          </Text>
          <div className="flex items-center gap-2 mt-1">
            <Tag color="blue">AY: {r.academicYear}</Tag>
            {r.semester && <Tag color="green">Sem: {r.semester}</Tag>}
          </div>
        </div>
      ),
    },
    {
      title: "Contact",
      key: "contact",
      width: "22%",
      render: (_, r) => (
        <div>
          <div className="flex items-center mb-1">
            <PhoneOutlined className="mr-1 text-gray-400" />
            <Text className="text-sm">{r.student?.contact || "N/A"}</Text>
          </div>
          <div className="flex items-center">
            <MailOutlined className="mr-1 text-gray-400" />
            <Text className="text-sm text-blue-500">
              {r.student?.email || "N/A"}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: "Internship Applications",
      key: "apps",
      render: (_, r) => {
        const apps = r.student?.internshipApplications || [];
        if (!apps.length)
          return <Text className="text-gray-400 text-sm">No applications</Text>;

        return (
          <div className="space-y-2">
            {apps.slice(0, 2).map((app) => (
              <Card
                key={app.id}
                size="small"
                className="border border-gray-200"
              >
                <Text strong className="block text-sm">
                  {app.internship?.title || "N/A"}
                </Text>
                <div className="flex items-center justify-between mt-1">
                  <Tag color={statusColor(app)} size="small">
                    {app.hasJoined ? "ACTIVE" : app.status}
                  </Tag>
                  {app.isSelected && !app.hasJoined && (
                    <Tag color="gold" size="small">
                      Selected
                    </Tag>
                  )}
                </div>
                <Text className="text-xs text-gray-400">
                  Applied {dayjs(app.applicationDate).format("MMM DD")}
                </Text>
              </Card>
            ))}
            {apps.length > 2 && (
              <Text className="text-xs text-blue-500">
                +{apps.length - 2} more
              </Text>
            )}
          </div>
        );
      },
    },
  ];

  /* ------------------------------------------------------------------ */
  /*  Render                                                            */
  /* ------------------------------------------------------------------ */
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spin size="small" />
        <Text className="ml-4">Loading students…</Text>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Alert
          title="Error Loading Assigned Students"
          description={error}
          type="error"
          showIcon
          className="mb-4"
        />
        <Button
          type="primary"
          onClick={forceRefresh}
          icon={<ReloadOutlined />}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <Title level={2} className="mb-0">
            Assigned Students ({safeStudents.length})
          </Title>
          <Button
            icon={<ReloadOutlined />}
            onClick={forceRefresh}
            loading={loading}
          >
            Refresh
          </Button>
        </div>

        {/* Table */}
          {safeStudents.length > 0 ? (
            <Table
              columns={columns}
              dataSource={safeStudents}
              rowKey={(record) => record?.id || Math.random()}
              pagination={{
                pageSize: 5,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) =>
                  `${range[0]}-${range[1]} of ${total} students`,
              }}
              bordered
              size="small"
                 scroll={{ x: "max-content" }}
            />
          ) : (
            <Card className="text-center py-12">
              <Empty
                description="No students assigned yet"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                <Text className="text-gray-500">
                  Students will appear here once they are assigned to you by the
                  admin.
                </Text>
              </Empty>
            </Card>
          )}
      </div>
    </>
  );
}