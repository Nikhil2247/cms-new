// FilterBuilder Component - Dynamic Filter Configuration
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Form,
  Select,
  Input,
  InputNumber,
  DatePicker,
  Switch,
  Spin,
  Space,
  Tooltip,
  Typography,
  Row,
  Col,
  Button,
  Alert,
} from "antd";
import {
  InfoCircleOutlined,
  FilterOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import { getFilterValues } from "../../services/reportBuilderApi";
import { formatLabel } from "../../utils/reportBuilderUtils";
import {
  fetchInstitutions,
  forceRefreshInstitutions,
  selectInstitutions,
  selectInstitutionsLoading,
  selectInstitutionsError,
} from "../../features/state/store/stateSlice";

const { Option } = Select;
const { RangePicker } = DatePicker;
const { Text } = Typography;

// Filter IDs that should use Redux institution data (lowercase for comparison)
const INSTITUTION_FILTER_IDS = ["institutionid", "institution", "instituteid", "institute"];

const FilterBuilder = ({
  filters = [],
  reportType,
  values = {},
  onChange,
  loading = false,
  disabled = false,
  compact = false,
}) => {
  const dispatch = useDispatch();
  const [dynamicOptions, setDynamicOptions] = useState({});
  const [loadingOptions, setLoadingOptions] = useState({});

  // Redux institution data
  const institutions = useSelector(selectInstitutions);
  const institutionsLoading = useSelector(selectInstitutionsLoading);
  const institutionsError = useSelector(selectInstitutionsError);

  // Transform institutions to filter options format
  const institutionOptions = useMemo(() => {
    return institutions.map((inst) => ({
      value: inst.id,
      label: inst.name || inst.code || inst.id,
    }));
  }, [institutions]);

  // Check if any filter needs institution data
  const needsInstitutions = useMemo(() => {
    return filters.some((filter) =>
      INSTITUTION_FILTER_IDS.includes(filter.id.toLowerCase())
    );
  }, [filters]);

  // Fetch institutions from Redux if needed
  useEffect(() => {
    if (needsInstitutions && institutions.length === 0 && !institutionsLoading) {
      dispatch(fetchInstitutions());
    }
  }, [needsInstitutions, institutions.length, institutionsLoading, dispatch]);

  // Handle retry for institution loading
  const handleRetryInstitutions = useCallback(() => {
    dispatch(forceRefreshInstitutions());
  }, [dispatch]);

  // Load dynamic filter options when filters change
  useEffect(() => {
    filters.forEach((filter) => {
      // Skip institution filters - they use Redux
      if (INSTITUTION_FILTER_IDS.includes(filter.id.toLowerCase())) {
        return;
      }
      if (filter.dynamic && reportType) {
        loadDynamicOptions(filter.id);
      }
    });
  }, [filters, reportType]);

  const loadDynamicOptions = async (filterId) => {
    setLoadingOptions((prev) => ({ ...prev, [filterId]: true }));
    try {
      const response = await getFilterValues(reportType, filterId);
      // Response.data contains the options array directly
      const options = response?.data || [];
      setDynamicOptions((prev) => ({
        ...prev,
        [filterId]: options,
      }));
    } catch (error) {
      console.error(`Error loading options for ${filterId}:`, error);
      setDynamicOptions((prev) => ({
        ...prev,
        [filterId]: [],
      }));
    } finally {
      setLoadingOptions((prev) => ({ ...prev, [filterId]: false }));
    }
  };

  const handleFilterChange = (filterId, value) => {
    onChange?.({
      ...values,
      [filterId]: value,
    });
  };

  const getFilterOptions = (filter) => {
    // Use Redux institutions for institution filters
    if (INSTITUTION_FILTER_IDS.includes(filter.id.toLowerCase())) {
      return institutionOptions;
    }
    if (filter.dynamic) {
      return dynamicOptions[filter.id] || [];
    }
    return filter.options || [];
  };

  const isFilterLoading = (filter) => {
    if (INSTITUTION_FILTER_IDS.includes(filter.id.toLowerCase())) {
      return institutionsLoading;
    }
    return loadingOptions[filter.id];
  };

  const renderFilterInput = (filter) => {
    const commonProps = {
      disabled,
      placeholder: filter.placeholder || `Select ${filter.label}`,
      className: "w-full",
      size: compact ? "middle" : "large",
    };

    // Get appropriate not found content based on filter type and state
    const getNotFoundContent = (filter) => {
      const isInstitutionFilter = INSTITUTION_FILTER_IDS.includes(filter.id.toLowerCase());

      if (isFilterLoading(filter)) {
        return <Spin size="small" />;
      }

      if (isInstitutionFilter && institutionsError) {
        return (
          <div className="py-2 text-center">
            <Text type="danger" className="text-xs">Failed to load</Text>
            <Button
              type="link"
              size="small"
              icon={<ReloadOutlined />}
              onClick={handleRetryInstitutions}
            >
              Retry
            </Button>
          </div>
        );
      }

      return "No options available";
    };

    switch (filter.type) {
      case "select":
        return (
          <Select
            {...commonProps}
            allowClear
            showSearch
            optionFilterProp="children"
            filterOption={(input, option) =>
              (option?.children ?? '').toLowerCase().includes(input.toLowerCase())
            }
            value={values[filter.id]}
            onChange={(val) => handleFilterChange(filter.id, val)}
            loading={isFilterLoading(filter)}
            notFoundContent={getNotFoundContent(filter)}
          >
            {getFilterOptions(filter).map((opt) => (
              <Option key={opt.value} value={opt.value}>
                {opt.label}
              </Option>
            ))}
          </Select>
        );

      case "multiSelect":
        return (
          <Select
            {...commonProps}
            mode="multiple"
            allowClear
            showSearch
            optionFilterProp="children"
            filterOption={(input, option) =>
              (option?.children ?? '').toLowerCase().includes(input.toLowerCase())
            }
            value={values[filter.id]}
            onChange={(val) => handleFilterChange(filter.id, val)}
            loading={isFilterLoading(filter)}
            maxTagCount="responsive"
            notFoundContent={getNotFoundContent(filter)}
          >
            {getFilterOptions(filter).map((opt) => (
              <Option key={opt.value} value={opt.value}>
                {opt.label}
              </Option>
            ))}
          </Select>
        );

      case "dateRange":
        return (
          <RangePicker
            {...commonProps}
            value={values[filter.id]}
            onChange={(val) => handleFilterChange(filter.id, val)}
            format="YYYY-MM-DD"
          />
        );

      case "boolean":
        return (
          <Switch
            disabled={disabled}
            checked={values[filter.id]}
            onChange={(val) => handleFilterChange(filter.id, val)}
            checkedChildren="Yes"
            unCheckedChildren="No"
          />
        );

      case "number":
        return (
          <InputNumber
            {...commonProps}
            value={values[filter.id]}
            onChange={(val) => handleFilterChange(filter.id, val)}
            min={filter.min}
            max={filter.max}
            step={filter.step || 1}
          />
        );

      case "text":
      default:
        return (
          <Input
            {...commonProps}
            value={values[filter.id]}
            onChange={(e) => handleFilterChange(filter.id, e.target.value)}
          />
        );
    }
  };

  if (loading) {
    return (
      <div className="py-8 text-center">
        <Spin tip="Loading filters..." />
      </div>
    );
  }

  if (!filters || filters.length === 0) {
    return (
      <div className="py-4 text-center text-gray-500">
        <FilterOutlined className="text-2xl mb-2" />
        <p>No filters available for this report type</p>
      </div>
    );
  }

  const colSpan = compact ? { xs: 24, sm: 12, md: 8 } : { xs: 24, sm: 12 };

  // Show institution loading error with retry option
  const showInstitutionError = needsInstitutions && institutionsError && !institutionsLoading;

  return (
    <div className="filter-builder">
      {/* Institution loading error alert */}
      {showInstitutionError && (
        <Alert
          title="Failed to load institutions"
          description={
            <Space>
              <span>{institutionsError}</span>
              <Button
                size="small"
                icon={<ReloadOutlined />}
                onClick={handleRetryInstitutions}
              >
                Retry
              </Button>
            </Space>
          }
          type="warning"
          showIcon
          icon={<ExclamationCircleOutlined />}
          className="mb-4"
        />
      )}

      <Row gutter={[16, compact ? 8 : 16]}>
        {filters.map((filter) => (
          <Col key={filter.id} {...colSpan}>
            <Form.Item
              label={
                <Space>
                  <span>{filter.label}</span>
                  {filter.description && (
                    <Tooltip title={filter.description}>
                      <InfoCircleOutlined className="text-gray-400 cursor-help" />
                    </Tooltip>
                  )}
                  {filter.required && (
                    <Text type="danger" className="text-xs">*</Text>
                  )}
                </Space>
              }
              className={compact ? "mb-2" : "mb-4"}
              validateStatus={
                filter.required && !values[filter.id] ? "warning" : ""
              }
            >
              {renderFilterInput(filter)}
            </Form.Item>
          </Col>
        ))}
      </Row>
    </div>
  );
};

export default FilterBuilder;