// src/pages/internships/BrowseInternships.jsx
import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Input,
  Select,
  Button,
  Tag,
  Typography,
  Space,
  List,
  Avatar,
  Pagination,
  Empty,
  Spin,
  message,
  Modal,
} from 'antd';
import {
  SearchOutlined,
  EnvironmentOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  BankOutlined,
  EyeOutlined,
  BookOutlined,
  CalendarOutlined,
  TeamOutlined,
  FilterOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import Layouts from '../../components/Layout';
import API from '../../services/api';
import { toast } from "react-hot-toast";
import { useDebounce } from '../../hooks/useDebounce';
import { theme } from 'antd';

const { Title, Text, Paragraph } = Typography;
const { Search } = Input;
const { Option } = Select;
const { useToken } = theme;

const BrowseInternships = () => {
  const { token } = useToken();
  const [loading, setLoading] = useState(true);
  const [internships, setInternships] = useState([]);
  const [appliedInternships, setAppliedInternships] = useState(new Set());
  const [filteredInternships, setFilteredInternships] = useState([]);
  const [searchText, setSearchText] = useState('');
  const debouncedSearchText = useDebounce(searchText, 300);
  const [showApplied, setShowApplied] = useState(false); // Toggle to show/hide applied internships
  const [filters, setFilters] = useState({
    fieldOfWork: '',
    workLocation: '',
    duration: '',
    isStipendProvided: '',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(9);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    filterInternships();
  }, [debouncedSearchText, filters, internships, appliedInternships, showApplied]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch both eligible internships and student's applications
      const [internshipsResponse, applicationsResponse] = await Promise.all([
        API.get('/internships/eligible'),
        API.get('/internship-applications/my-applications')
      ]);
      
      if (internshipsResponse) {
        setInternships(internshipsResponse.data || []);
      }
      // console.log(internshipsResponse.data.data);

      // Create a Set of internship IDs that the student has applied for
      if (applicationsResponse.data && applicationsResponse.data.success) {
        const appliedIds = new Set(
          (applicationsResponse.data.data || []).map(app => app.internshipId)
        );
        setAppliedInternships(appliedIds);
      }
    } catch (error) {
      toast.error(error.message || 'Error fetching data');
      setInternships([]);
    } finally {
      setLoading(false);
    }
  };

  const filterInternships = () => {
    let filtered = internships;

    // Filter out applied internships unless showApplied is true
    if (!showApplied) {
      filtered = filtered.filter(item => !appliedInternships.has(item.id));
    }

    // Search filter (use debounced value)
    if (debouncedSearchText) {
      filtered = filtered.filter(item =>
        item.title?.toLowerCase().includes(debouncedSearchText.toLowerCase()) ||
        item.industry?.companyName?.toLowerCase().includes(debouncedSearchText.toLowerCase()) ||
        item.fieldOfWork?.toLowerCase().includes(debouncedSearchText.toLowerCase())
      );
    }

    // Field of work filter
    if (filters.fieldOfWork) {
      filtered = filtered.filter(item => 
        item.fieldOfWork?.toLowerCase().includes(filters.fieldOfWork.toLowerCase())
      );
    }

    // Work location filter
    if (filters.workLocation) {
      filtered = filtered.filter(item => item.workLocation === filters.workLocation);
    }

    // Duration filter
    if (filters.duration) {
      filtered = filtered.filter(item => item.duration === filters.duration);
    }

    // Stipend filter
    if (filters.isStipendProvided !== '') {
      filtered = filtered.filter(item => 
        item.isStipendProvided === (filters.isStipendProvided === 'true')
      );
    }

    setFilteredInternships(filtered);
    setCurrentPage(1);
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      fieldOfWork: '',
      workLocation: '',
      duration: '',
      isStipendProvided: '',
    });
    setSearchText('');
  };

  const handleViewDetails = (internship) => {
    navigate(`/internships/${internship.id}`);
  };

  const getStatusColor = (deadline) => {
    const daysLeft = Math.ceil((new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 3) return 'red';
    if (daysLeft <= 7) return 'orange';
    return 'green';
  };

  const getDaysLeft = (deadline) => {
    const daysLeft = Math.ceil((new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24));
    return daysLeft > 0 ? daysLeft : 0;
  };

  // Check if internship is applied
  const isApplied = (internshipId) => appliedInternships.has(internshipId);

  // Get applied internships count
  const appliedCount = internships.filter(item => appliedInternships.has(item.id)).length;

  // Pagination
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentInternships = filteredInternships.slice(startIndex, endIndex);

  return (
    <Layouts>
      <div className="min-h-screen ">
        <div className=" mx-auto">
          {/* Header */}
          <div className="mb-6">
            <Title level={2} className="mb-2">
              Browse Internships
            </Title>
            <Text className="text-text-secondary text-lg">
              Discover exciting internship opportunities that match your skills and interests
            </Text>
            
            {/* Applied internships info */}
            {appliedCount > 0 && (
              <div className="mt-4 p-4 bg-primary-50 rounded-lg border border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <CheckCircleOutlined className="mr-2 text-primary" />
                    <Text className="text-primary font-medium">
                      You have applied to <strong>{appliedCount}</strong> internship{appliedCount !== 1 ? 's' : ''}
                    </Text>
                  </div>
                  <Button
                    type="link"
                    onClick={() => setShowApplied(!showApplied)}
                    className="text-primary font-medium"
                  >
                    {showApplied ? 'Hide Applied' : 'Show Applied'} Internships
                  </Button>
                </div>
              </div>
            )}
          </div>

          <Row gutter={[24, 24]}>
            {/* Filters Sidebar */}
            <Col xs={24} lg={6}>
              <Card className="sticky top-6 rounded-2xl border-border">
                <div className="flex items-center justify-between mb-6">
                  <Title level={4} className="mb-0 flex items-center">
                    <FilterOutlined className="mr-2 text-primary" />
                    Filters
                  </Title>
                  <Button type="link" onClick={clearFilters} className="text-primary">
                    Clear All
                  </Button>
                </div>

                <div className="space-y-6">
                  {/* Search */}
                  <div>
                    <Text strong className="block mb-2 text-text-secondary">Search</Text>
                    <Search
                      placeholder="Search internships..."
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      className="rounded-lg"
                      allowClear
                    />
                  </div>

                  {/* Show Applied Toggle */}
                  <div>
                    <Text strong className="block mb-2 text-text-secondary">View Options</Text>
                    <Select
                      value={showApplied ? 'applied' : 'available'}
                      onChange={(value) => setShowApplied(value === 'applied')}
                      className="w-full rounded-lg"
                    >
                      <Option value="available">Available Internships</Option>
                      <Option value="applied">Applied Internships ({appliedCount})</Option>
                    </Select>
                  </div>

                  {/* Field of Work */}
                  <div>
                    <Text strong className="block mb-2 text-text-secondary">Field of Work</Text>
                    <Select
                      placeholder="Select field"
                      value={filters.fieldOfWork}
                      onChange={(value) => handleFilterChange('fieldOfWork', value)}
                      className="w-full rounded-lg"
                      allowClear
                    >
                      <Option value="Software Development">Software Development</Option>
                      <Option value="Web Development">Web Development</Option>
                      <Option value="Mobile Development">Mobile Development</Option>
                      <Option value="Data Science">Data Science</Option>
                      <Option value="UI/UX Design">UI/UX Design</Option>
                      <Option value="Digital Marketing">Digital Marketing</Option>
                      <Option value="Mechanical Engineering">Mechanical Engineering</Option>
                      <Option value="Civil Engineering">Civil Engineering</Option>
                      <Option value="Electrical Engineering">Electrical Engineering</Option>
                    </Select>
                  </div>

                  {/* Work Location */}
                  <div>
                    <Text strong className="block mb-2 text-text-secondary">Work Location</Text>
                    <Select
                      placeholder="Select location"
                      value={filters.workLocation}
                      onChange={(value) => handleFilterChange('workLocation', value)}
                      className="w-full rounded-lg"
                      allowClear
                    >
                      <Option value="ON_SITE">On-site</Option>
                      <Option value="REMOTE">Remote</Option>
                      <Option value="HYBRID">Hybrid</Option>
                    </Select>
                  </div>

                  {/* Duration */}
                  <div>
                    <Text strong className="block mb-2 text-text-secondary">Duration</Text>
                    <Select
                      placeholder="Select duration"
                      value={filters.duration}
                      onChange={(value) => handleFilterChange('duration', value)}
                      className="w-full rounded-lg"
                      allowClear
                    >
                      <Option value="1 month">1 Month</Option>
                      <Option value="2 months">2 Months</Option>
                      <Option value="3 months">3 Months</Option>
                      <Option value="4 months">4 Months</Option>
                      <Option value="5 months">5 Months</Option>
                      <Option value="6 months">6 Months</Option>
                    </Select>
                  </div>

                  {/* Stipend */}
                  <div>
                    <Text strong className="block mb-2 text-text-secondary">Stipend</Text>
                    <Select
                      placeholder="Select stipend type"
                      value={filters.isStipendProvided}
                      onChange={(value) => handleFilterChange('isStipendProvided', value)}
                      className="w-full rounded-lg"
                      allowClear
                    >
                      <Option value="true">Paid</Option>
                      <Option value="false">Unpaid</Option>
                    </Select>
                  </div>
                </div>
              </Card>
            </Col>

            {/* Internships Grid */}
            <Col xs={24} lg={18}>
              <div className="mb-4 flex justify-between items-center">
                <div>
                  <Text className="text-text-secondary">
                    <strong>{filteredInternships.length}</strong> internship{filteredInternships.length !== 1 ? 's' : ''} found
                  </Text>
                </div>
                <Select
                  defaultValue="newest"
                  className="w-40 rounded-lg"
                  placeholder="Sort by"
                >
                  <Option value="newest">Newest First</Option>
                  <Option value="deadline">Deadline</Option>
                  <Option value="stipend">Highest Stipend</Option>
                  <Option value="duration">Duration</Option>
                </Select>
              </div>

              {loading ? (
                <div className="flex justify-center items-center py-20">
                  <Spin size="small" />
                  <Text className="ml-4 text-text-secondary">Loading internships...</Text>
                </div>
              ) : currentInternships.length > 0 ? (
                <>
                  <Row gutter={[24, 24]}>
                    {currentInternships.map((internship) => {
                      const applied = isApplied(internship.id);
                      
                      return (
                        <Col xs={24} md={12} xl={8} key={internship.id}>
                          <Card
                            className={`h-full rounded-2xl border-border shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 bg-background/90 backdrop-blur-sm overflow-hidden ${
                              applied ? 'ring-2 ring-success-200' : ''
                            }`}
                            styles={{ body: { padding: 0 } }}
                          >
                            {/* Card Header */}
                            <div 
                              className="p-6 text-white relative overflow-hidden"
                              style={{
                                background: applied
                                  ? `linear-gradient(135deg, ${token.colorSuccess} 0%, ${token.colorSuccessBg} 100%)`
                                  : `linear-gradient(135deg, ${token.colorPrimary} 0%, ${token.colorPrimaryBg} 100%)`
                              }}
                            >
                              <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-10 translate-x-10"></div>
                              <div className="relative z-10">
                                <div className="flex items-center justify-between mb-4">
                                  <Avatar
                                    size={50}
                                    icon={<BankOutlined />}
                                    className="bg-white/20 border-2 border-white/30"
                                  />
                                  <div className="flex flex-col items-end gap-2">
                                    {applied ? (
                                      <Tag className="border-white/30 text-success-800 px-3 py-1 rounded-full font-medium bg-white/90">
                                        <CheckCircleOutlined className="mr-1" />
                                        Applied
                                      </Tag>
                                    ) : (
                                      <Tag 
                                        color={getStatusColor(internship.applicationDeadline)}
                                        className="px-3 py-1 rounded-full font-medium"
                                      >
                                        {getDaysLeft(internship.applicationDeadline)} days left
                                      </Tag>
                                    )}
                                  </div>
                                </div>
                                <Title level={5} className="text-white mb-1 line-clamp-2">
                                  {internship.title}
                                </Title>
                                <Text className="font-medium text-white/90">
                                  {internship.industry?.companyName}
                                </Text>
                              </div>
                            </div>

                            {/* Card Body */}
                            <div className="p-6 space-y-4">
                              {/* Field and Location */}
                              <div className="flex flex-wrap gap-2">
                                <Tag color="blue" className="rounded-full">
                                  <BookOutlined className="mr-1" />
                                  {internship.fieldOfWork}
                                </Tag>
                                <Tag color="green" className="rounded-full">
                                  <EnvironmentOutlined className="mr-1" />
                                  {internship.workLocation?.replace('_', ' ')}
                                </Tag>
                              </div>

                              {/* Description */}
                              <Paragraph 
                                className="text-text-secondary text-sm line-clamp-3 mb-4"
                                ellipsis={{ rows: 3 }}
                              >
                                {internship.description}
                              </Paragraph>

                              {/* Details Grid */}
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div className="flex items-center text-text-tertiary">
                                  <ClockCircleOutlined className="mr-2 text-warning" />
                                  <span>{internship.duration}</span>
                                </div>
                                <div className="flex items-center text-text-tertiary">
                                  <TeamOutlined className="mr-2 text-primary" />
                                  <span>{internship.numberOfPositions} positions</span>
                                </div>
                                <div className="flex items-center text-text-tertiary">
                                  <CalendarOutlined className="mr-2 text-info" />
                                  <span>Start: {new Date(internship.startDate).toLocaleDateString()}</span>
                                </div>
                                <div className="flex items-center text-text-tertiary">
                                  <DollarOutlined className="mr-2 text-success" />
                                  <span>
                                    {internship.isStipendProvided 
                                      ? `₹${internship.stipendAmount?.toLocaleString()}`
                                      : 'Unpaid'
                                    }
                                  </span>
                                </div>
                              </div>

                              {/* Action Button */}
                              <Button
                                type="primary"
                                block
                                icon={applied ? <CheckCircleOutlined /> : <EyeOutlined />}
                                onClick={() => handleViewDetails(internship)}
                                className="mt-6 h-12 rounded-xl border-0 font-semibold text-base hover:scale-105 transition-all duration-200"
                                style={{
                                  background: applied ? token.colorSuccess : token.colorPrimary
                                }}
                              >
                                {applied ? 'View Application' : 'View Details & Apply'}
                              </Button>
                            </div>
                          </Card>
                        </Col>
                      );
                    })}
                  </Row>

                  {/* Pagination */}
                  {filteredInternships.length > pageSize && (
                    <div className="mt-12 text-center">
                      <Pagination
                        current={currentPage}
                        pageSize={pageSize}
                        total={filteredInternships.length}
                        onChange={setCurrentPage}
                        showSizeChanger={false}
                        showQuickJumper
                        showTotal={(total, range) =>
                          `${range[0]}-${range[1]} of ${total} internships`
                        }
                        className="custom-pagination"
                      />
                    </div>
                  )}
                </>
              ) : (
                <Card className="text-center py-20 rounded-2xl ">
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                      <div>
                        <Title level={4} className="text-gray-500 mb-2">
                          {showApplied ? 'No applied internships found' : 'No available internships found'}
                        </Title>
                        <Text className="text-gray-400">
                          {showApplied 
                            ? 'You haven\'t applied to any internships yet'
                            : 'Try adjusting your filters or search terms'
                          }
                        </Text>
                      </div>
                    }
                  >
                    {showApplied ? (
                      <Button 
                        type="primary" 
                        onClick={() => setShowApplied(false)} 
                        className="rounded-lg"
                      >
                        Browse Available Internships
                      </Button>
                    ) : (
                      <Button type="primary" onClick={clearFilters} className="rounded-lg">
                        Clear Filters
                      </Button>
                    )}
                  </Empty>
                </Card>
              )}
            </Col>
          </Row>
        </div>

        <style jsx>{`
          .line-clamp-2 {
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }
          .line-clamp-3 {
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }
          .custom-pagination .ant-pagination-item {
            border-radius: 8px;
          }
          .custom-pagination .ant-pagination-item-active {
            border-color: currentColor;
          }
          .custom-pagination .ant-pagination-item-active a {
          }
        `}</style>
      </div>
    </Layouts>
  );
};

export default BrowseInternships;