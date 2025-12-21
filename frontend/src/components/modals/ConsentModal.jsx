import React, { useState } from "react";
import {
  Modal,
  Typography,
  Button,
  Checkbox,
  Divider,
  Space,
  Alert,
  Collapse,
} from "antd";
import {
  CheckCircleOutlined,
  SafetyOutlined,
  FileProtectOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import { Link } from "react-router-dom";

const { Title, Paragraph, Text } = Typography;
const { Panel } = Collapse;

const ConsentModal = ({ visible, onAccept, onCancel, loading = false }) => {
  const [agreed, setAgreed] = useState(false);

  const handleAccept = () => {
    if (agreed && onAccept) {
      onAccept();
    }
  };

  const termsHighlights = [
    {
      icon: <SafetyOutlined className="!text-primary" />,
      title: "Data Privacy & Security",
      content:
        "Your personal information is stored securely and used solely for academic, internship coordination, and placement purposes. We employ industry-standard encryption and security measures.",
    },
    {
      icon: <FileProtectOutlined className="!text-success" />,
      title: "Information Sharing",
      content:
        "With your consent, we may share relevant information with authorized institutional partners, industry collaborators, and placement coordinators to facilitate your internship and career opportunities.",
    },
    {
      icon: <InfoCircleOutlined className="!text-warning" />,
      title: "Your Rights",
      content:
        "You retain the right to access, modify, or request deletion of your personal data. You may withdraw consent at any time, though this may limit access to certain platform features and services.",
    },
  ];

  return (
    <Modal
      open={visible}
      title={
        <div className="flex items-center gap-2">
          <CheckCircleOutlined className="text-primary" />
          <span>Terms & Conditions Agreement</span>
        </div>
      }
      onCancel={onCancel}
      closable={!loading}
      maskClosable={false}
      keyboard={false}
      width={1000}
      className="rounded-xl overflow-hidden"
      footer={[
        <Button key="cancel" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>,
        <Button
          key="accept"
          type="primary"
          onClick={handleAccept}
          disabled={!agreed}
          loading={loading}
          icon={<CheckCircleOutlined />}
        >
          Accept & Continue
        </Button>,
      ]}
    >
      <Space direction="vertical" size="large" className="w-full">
        {/* Introduction Alert */}
        <Alert
          title="Welcome to the College Management System"
          description="To proceed, please review and accept our Terms & Conditions and Privacy Policy. Your consent helps us provide you with the best academic and career services."
          type="info"
          showIcon
          icon={<SafetyOutlined />}
          className="rounded-lg"
        />

        {/* Key Terms Section */}
        <div>
          <Title level={5} className="mb-3">
            Key Terms & Privacy Highlights
          </Title>
          <Space direction="vertical" size="middle" className="w-full">
            {termsHighlights.map((item, index) => (
              <div
                key={index}
                className="p-4 rounded-xl border border-border bg-background-tertiary/30"
              >
                <div className="flex items-start gap-3">
                  <div className="text-xl mt-1">{item.icon}</div>
                  <div className="flex-1">
                    <Text strong className="block mb-1 text-text-primary">
                      {item.title}
                    </Text>
                    <Text className="text-text-secondary text-sm">
                      {item.content}
                    </Text>
                  </div>
                </div>
              </div>
            ))}
          </Space>
        </div>

        {/* Expandable Additional Terms */}
        <Collapse
          ghost
          className="rounded-lg border border-border"
          items={[
            {
              key: "1",
              label: (
                <Text strong className="text-primary">
                  View Additional Terms & Conditions
                </Text>
              ),
              children: (
                <div className="space-y-3">
                  <div>
                    <Text strong className="block mb-1">
                      Service Usage
                    </Text>
                    <Text className="text-sm text-text-secondary">
                      By using this platform, you agree to use it solely for
                      educational, internship, and placement-related activities.
                      Misuse of the system or unauthorized access attempts will
                      result in account suspension.
                    </Text>
                  </div>
                  <div>
                    <Text strong className="block mb-1">
                      Academic Records
                    </Text>
                    <Text className="text-sm text-text-secondary">
                      All academic records remain the property of the
                      institution. You grant necessary permissions for
                      processing this data to provide educational services and
                      maintain compliance with academic standards.
                    </Text>
                  </div>
                  <div>
                    <Text strong className="block mb-1">
                      Communication Preferences
                    </Text>
                    <Text className="text-sm text-text-secondary">
                      We may send you important notifications regarding
                      internships, placements, academic updates, and system
                      announcements. You can manage notification preferences in
                      your account settings.
                    </Text>
                  </div>
                </div>
              ),
            },
          ]}
        />

        <Divider className="my-2" />

        {/* Full Documents Link */}
        <div className="text-center p-3 rounded-lg bg-background-tertiary/50">
          <Text className="text-sm text-text-secondary">
            For complete details, please review our full{" "}
            <Link
              to="/terms-and-conditions"
              target="_blank"
              className="font-medium text-primary hover:underline"
            >
              Terms & Conditions
            </Link>{" "}
            and{" "}
            <Link
              to="/privacy-policy"
              target="_blank"
              className="font-medium text-primary hover:underline"
            >
              Privacy Policy
            </Link>
            .
          </Text>
        </div>

        {/* Consent Checkbox */}
        <div className="p-4 rounded-xl border-2 border-primary/30 bg-primary-50/10">
          <Checkbox
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="w-full"
          >
            <Text strong className="text-text-primary">
              I have read, understood, and agree to the Terms & Conditions and
              Privacy Policy of the College Management System.
            </Text>
          </Checkbox>
        </div>

        {/* Footer Note */}
        <div className="text-center">
          <Text className="text-xs text-text-tertiary">
            By accepting, you confirm that you are authorized to provide this
            consent and that all information you provide is accurate.
          </Text>
        </div>
      </Space>
    </Modal>
  );
};

export default ConsentModal;