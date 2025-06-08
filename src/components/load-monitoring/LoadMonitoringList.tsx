import React from 'react';
import { Link } from 'react-router-dom';
import { LoadMonitoringData } from '@/lib/asset-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, parse } from 'date-fns';

interface LoadMonitoringListProps {
  records: LoadMonitoringData[];
}

const formatDateOnly = (dateStr: string) => {
  try {
    const date = new Date(dateStr);
    return format(date, 'MMM d, yyyy');
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateStr;
  }
};

export function LoadMonitoringList({ records }: LoadMonitoringListProps) {
  if (records.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No load monitoring records found</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {records.map((record) => (
        <Link to={`/load-monitoring/${record.id}`} key={record.id}>
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                <span>{record.substationName}</span>
                <Badge variant={record.peakLoadStatus === 'day' ? 'default' : 'secondary'}>
                  {record.peakLoadStatus}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p><strong>Substation No:</strong> {record.substationNumber}</p>
                <p><strong>Location:</strong> {record.location}</p>
                <p><strong>Rating:</strong> {record.rating} MW</p>
                <p><strong>Date:</strong> {formatDateOnly(record.date)}</p>
                <p><strong>Percentage Load:</strong> {record.percentageLoad}%</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
} 