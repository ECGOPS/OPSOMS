import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useData } from '@/contexts/DataContext';
import { LoadMonitoringData } from '@/lib/asset-types';
import { AccessControlWrapper } from '@/components/access-control/AccessControlWrapper';
import { Button, Table, Modal, Form, Input, DatePicker, Select, message, Badge } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import moment from 'moment';
import { getFirestore, collection, query, where, orderBy, limit, startAt, getCountFromServer, getDocs, startAfter } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { Label } from '@/components/ui/label';

const { Option } = Select;

const LoadMonitoringPage: React.FC = () => {
  const { 
    loadMonitoringRecords, 
    saveLoadMonitoringRecord, 
    updateLoadMonitoringRecord, 
    deleteLoadMonitoringRecord,
    regions,
    districts,
    setLoadMonitoringRecords,
    canEditLoadMonitoring,
    canDeleteLoadMonitoring
  } = useData();
  const { isAuthenticated, user } = useAuth();

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);

  // Filter states
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<LoadMonitoringData | null>(null);
  const [form] = Form.useForm();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<Date | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Cache for frequently accessed data
  const [dataCache, setDataCache] = useState<{ [key: string]: LoadMonitoringData[] }>({});
  const [totalCountCache, setTotalCountCache] = useState<{ [key: string]: number }>({});

  // Build cache key based on current filters
  const getCacheKey = useCallback(() => {
    return `${selectedDate?.toISOString()}-${selectedMonth?.toISOString()}-${selectedRegion}-${selectedDistrict}-${searchTerm}-${user?.role}-${user?.region}-${user?.district}`;
  }, [selectedDate, selectedMonth, selectedRegion, selectedDistrict, searchTerm, user]);

  // Optimize data loading with pagination and caching
  const loadData = useCallback(async (resetPagination = false) => {
    setIsLoading(true);
    try {
      const db = getFirestore();
      const loadMonitoringRef = collection(db, "loadMonitoring");
      
      // Build query based on filters
      let q = query(loadMonitoringRef);
      
      // Apply role-based filtering
      if (user?.role === 'regional_engineer') {
        q = query(q, where("region", "==", user.region));
      } else if (user?.role === 'district_engineer' || user?.role === 'technician') {
        q = query(q, where("district", "==", user.district));
      }
      
      // Apply date filter
      if (selectedDate) {
        const startOfDay = moment(selectedDate).startOf('day').toDate();
        const endOfDay = moment(selectedDate).endOf('day').toDate();
        q = query(q, where("date", ">=", startOfDay), where("date", "<=", endOfDay));
      }
      
      // Apply month filter
      if (selectedMonth) {
        const startOfMonth = moment(selectedMonth).startOf('month').toDate();
        const endOfMonth = moment(selectedMonth).endOf('month').toDate();
        q = query(q, where("date", ">=", startOfMonth), where("date", "<=", endOfMonth));
      }
      
      // Apply region filter
      if (selectedRegion) {
        q = query(q, where("region", "==", selectedRegion));
      }
      
      // Apply district filter
      if (selectedDistrict) {
        q = query(q, where("district", "==", selectedDistrict));
      }
      
      // Apply search term
      if (searchTerm) {
        q = query(q, where("substationName", ">=", searchTerm), where("substationName", "<=", searchTerm + '\uf8ff'));
      }

      // Get total count from cache or server
      const cacheKey = getCacheKey();
      let totalCount = totalCountCache[cacheKey];
      
      if (!totalCount) {
        const countSnapshot = await getCountFromServer(q);
        totalCount = countSnapshot.data().count;
        setTotalCountCache(prev => ({ ...prev, [cacheKey]: totalCount }));
      }
      
      setTotalItems(totalCount);
      
      // Reset pagination if filters changed
      if (resetPagination) {
        setCurrentPage(1);
        setLastVisible(null);
        setHasMore(true);
      }
      
      // Apply pagination
      q = query(
        q,
        orderBy("date", "desc"),
        limit(pageSize)
      );
      
      if (lastVisible && !resetPagination) {
        q = query(q, startAfter(lastVisible));
      }
      
      // Fetch data
      const snapshot = await getDocs(q);
      const newRecords = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as LoadMonitoringData[];
      
      // Update cache
      const updatedCache = { ...dataCache };
      const pageKey = `${cacheKey}-${currentPage}`;
      updatedCache[pageKey] = newRecords;
      setDataCache(updatedCache);
      
      // Update last visible document for pagination
      if (snapshot.docs.length > 0) {
        setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
      }
      
      setHasMore(snapshot.docs.length === pageSize);
      
      // Update records
      if (resetPagination) {
        setLoadMonitoringRecords(newRecords);
      } else {
        setLoadMonitoringRecords(prev => [...prev, ...newRecords]);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      message.error("Failed to load monitoring records");
    } finally {
      setIsLoading(false);
    }
  }, [user, selectedDate, selectedMonth, selectedRegion, selectedDistrict, searchTerm, currentPage, pageSize, lastVisible, dataCache, totalCountCache, getCacheKey]);

  // Load data on mount and when filters change
  useEffect(() => {
    if (isAuthenticated) {
      loadData(true);
    }
  }, [isAuthenticated, selectedDate, selectedMonth, selectedRegion, selectedDistrict, searchTerm]);

  // Load more data when scrolling
  const handleLoadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      setCurrentPage(prev => prev + 1);
      loadData();
    }
  }, [isLoading, hasMore, loadData]);

  // Optimize filtered records with useMemo
  const filteredRecords = useMemo(() => {
    if (!loadMonitoringRecords) return [];
    
    let filtered = loadMonitoringRecords;
    
    // Apply role-based filtering
    if (user?.role === 'regional_engineer') {
      filtered = filtered.filter(record => record.region === user.region);
    } else if (user?.role === 'district_engineer' || user?.role === 'technician') {
      filtered = filtered.filter(record => record.district === user.district);
    }
    
    // Apply date filter
    if (selectedDate) {
      filtered = filtered.filter(record => {
        const recordDate = new Date(record.date);
        return recordDate.toDateString() === selectedDate.toDateString();
      });
    }
    
    // Apply month filter
    if (selectedMonth) {
      filtered = filtered.filter(record => {
        const recordDate = new Date(record.date);
        return recordDate.getMonth() === selectedMonth.getMonth() && 
               recordDate.getFullYear() === selectedMonth.getFullYear();
      });
    }
    
    // Apply region filter
    if (selectedRegion) {
      filtered = filtered.filter(record => record.region === selectedRegion);
    }
    
    // Apply district filter
    if (selectedDistrict) {
      filtered = filtered.filter(record => record.district === selectedDistrict);
    }
    
    // Apply search term
    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(record => 
        record.substationName?.toLowerCase().includes(lowerCaseSearchTerm) ||
        record.substationNumber?.toLowerCase().includes(lowerCaseSearchTerm)
      );
    }
    
    return filtered;
  }, [loadMonitoringRecords, user, selectedDate, selectedMonth, selectedRegion, selectedDistrict, searchTerm]);

  // Handle add/edit/delete operations
  const handleAdd = () => {
    setEditingRecord(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (record: LoadMonitoringData) => {
    if (!canEditLoadMonitoring(record)) {
      message.error('You do not have permission to edit this record');
      return;
    }
    setEditingRecord(record);
    form.setFieldsValue({
      ...record,
      date: moment(record.date)
    });
    setIsModalVisible(true);
  };

  const handleDelete = (record: LoadMonitoringData) => {
    if (!canDeleteLoadMonitoring(record)) {
      message.error('You do not have permission to delete this record');
      return;
    }
    Modal.confirm({
      title: 'Are you sure you want to delete this record?',
      content: 'This action cannot be undone.',
      onOk: async () => {
        try {
          await deleteLoadMonitoringRecord(record.id);
          message.success('Record deleted successfully');
          loadData(); // Refresh data after deletion
        } catch (error) {
          message.error('Failed to delete record');
        }
      }
    });
  };

  const columns = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      render: (date: string) => moment(date).format('YYYY-MM-DD')
    },
    {
      title: 'Region',
      dataIndex: 'regionId',
      key: 'regionId',
      render: (regionId: string) => regions.find(r => r.id === regionId)?.name
    },
    {
      title: 'District',
      dataIndex: 'districtId',
      key: 'districtId',
      render: (districtId: string) => districts.find(d => d.id === districtId)?.name
    },
    {
      title: 'Peak Load (MW)',
      dataIndex: 'peakLoad',
      key: 'peakLoad'
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: LoadMonitoringData) => (
        <span>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            disabled={!canEditLoadMonitoring(record)}
          />
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
            disabled={!canDeleteLoadMonitoring(record)}
          />
        </span>
      )
    }
  ];

  return (
    <AccessControlWrapper type="asset">
      <div className="container mx-auto p-4">
        <div style={{ marginBottom: '16px' }}>
          <Button type="primary" onClick={handleAdd}>
            Add Load Monitoring Record
          </Button>
        </div>

        <Table
          dataSource={filteredRecords}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: totalItems,
            onChange: (page, size) => {
              setCurrentPage(page);
              setPageSize(size);
            },
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} items`,
            pageSizeOptions: ['10', '25', '50', '100']
          }}
        />

        <Modal
          title={editingRecord ? 'Edit Load Monitoring Record' : 'Add Load Monitoring Record'}
          open={isModalVisible}
          onOk={() => form.submit()}
          onCancel={() => setIsModalVisible(false)}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={async (values) => {
              try {
                if (editingRecord) {
                  await updateLoadMonitoringRecord(editingRecord.id, values);
                  message.success('Record updated successfully');
                } else {
                  await saveLoadMonitoringRecord(values);
                  message.success('Record added successfully');
                }
                setIsModalVisible(false);
                loadData(); // Refresh data after update
              } catch (error) {
                message.error('Failed to save record');
              }
            }}
          >
            <Form.Item
              name="date"
              label="Date"
              rules={[{ required: true, message: 'Please select a date' }]}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              name="regionId"
              label="Region"
              rules={[{ required: true, message: 'Please select a region' }]}
            >
              <Select>
                {regions.map(region => (
                  <Option key={region.id} value={region.id}>{region.name}</Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="districtId"
              label="District"
              rules={[{ required: true, message: 'Please select a district' }]}
            >
              <Select>
                {districts.map(district => (
                  <Option key={district.id} value={district.id}>{district.name}</Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="peakLoad"
              label="Peak Load (MW)"
              rules={[{ required: true, message: 'Please input the peak load' }]}
            >
              <Input type="number" />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </AccessControlWrapper>
  );
};

export default LoadMonitoringPage; 