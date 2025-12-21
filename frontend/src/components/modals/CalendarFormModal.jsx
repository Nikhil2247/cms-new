// src/components/CalendarFormModal.jsx
import React from "react";
import { Modal, Form, Input, DatePicker, message } from "antd";
import dayjs from "dayjs";
import API from "../../services/api";
import axios from "axios";
import { toast } from "react-hot-toast";

const CalendarFormModal = ({ open, onClose, onSuccess }) => {
  const [form] = Form.useForm();

  const handleSubmit = async (values) => {
    try {
      // Get institution ID from localStorage
      const loginData = localStorage.getItem("loginResponse");
      const parsed = JSON.parse(loginData);
      const institutionId = parsed?.user?.institutionId;

      const payload = {
        title: values.title,
        startDate: values.dates.toISOString(),
        institutionId // Include institutionId in the payload
        // endDate: values.dates[1].toISOString(),
      };
      await API.post("/calendar", payload);
      toast.success("Event added successfully");
      form.resetFields();
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Failed to add event");
    }
  };

  return (
    <Modal
      title="Add Calendar Event"
      open={open}
      onCancel={() => {
        form.resetFields();
        onClose();
      }}
      onOk={() => form.submit()}
      okText="Add Event"
      className="rounded-xl overflow-hidden"
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit} className="mt-4">
        <Form.Item
          name="title"
          label="Event Title"
          rules={[{ required: true, message: "Please enter a title" }]}
        >
          <Input placeholder="Enter event title" className="rounded-lg" />
        </Form.Item>
        <Form.Item
          name="dates"
          label="Event Date Range"
          rules={[{ required: true, message: "Please select date range" }]}
        >
          <DatePicker className="w-full rounded-lg" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CalendarFormModal;