import React, { useEffect, useState, useCallback } from 'react';
import { SecurityEvent } from '@/lib/types';
import { securityMonitoringService } from '@/services/SecurityMonitoringService';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import { Table, TableHeader, TableBody, TableCell, TableHead, TableRow } from '@/components/ui/table';
import { Trash2 } from 'lucide-react';
import { ActiveUsers } from './ActiveUsers';

const severityColors = {
  low: 'bg-blue-500',
  medium: 'bg-yellow-500',
  high: 'bg-red-500',
  critical: 'bg-purple-500'
} as const;

const statusVariants = {
  new: 'default',
  'in-progress': 'secondary',
  resolved: 'success',
  dismissed: 'destructive'
} as const;

export function SecurityMonitoring() {
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

  const fetchSecurityEvents = useCallback(async () => {
    try {
      setIsLoading(true);
      const events = await securityMonitoringService.getEvents();
      console.log('Fetched events:', JSON.stringify(events, null, 2));
      setSecurityEvents(events);
    } catch (error) {
      console.error('Error fetching security events:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSecurityEvents();
  }, [fetchSecurityEvents]);

  const filterSecurityEvents = useCallback(() => {
    console.log('Starting filterSecurityEvents');
    console.log('Current state:', {
      totalEvents: securityEvents.length,
      searchQuery,
      selectedSeverity
    });
    
    const filtered = securityEvents.filter(event => {
      const matchesSearch = searchQuery === '' || 
        event.eventType.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.userId.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesSeverity = selectedSeverity === 'all' || event.severity === selectedSeverity;
      
      console.log('Filtering event:', {
        id: event.id,
        eventType: event.eventType,
        severity: event.severity,
        matchesSearch,
        matchesSeverity,
        searchQuery: searchQuery || '(empty)',
        selectedSeverity
      });

      return matchesSearch && matchesSeverity;
    });

    console.log('Filtered results:', {
      totalFiltered: filtered.length,
      filteredEvents: filtered.map(e => ({ id: e.id, type: e.eventType, severity: e.severity }))
    });

    return filtered;
  }, [securityEvents, searchQuery, selectedSeverity]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedEvents(filterSecurityEvents().map(event => event.id));
    } else {
      setSelectedEvents([]);
    }
  };

  const handleDeleteSelected = async () => {
    try {
      await securityMonitoringService.deleteEvents(selectedEvents);
      setSelectedEvents([]);
      fetchSecurityEvents();
    } catch (error) {
      console.error('Error deleting selected events:', error);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      await securityMonitoringService.deleteEvent(eventId);
      setSelectedEvents(prev => prev.filter(id => id !== eventId));
      fetchSecurityEvents();
    } catch (error) {
      console.error('Error deleting event:', error);
    }
  };

  const filteredEvents = filterSecurityEvents();
  console.log('Final filtered events before render:', {
    count: filteredEvents.length,
    events: filteredEvents.map(e => e.id)
  });

  return (
    <div className="space-y-8">
      <ActiveUsers />
      
      <div className="space-y-4">
        <div className="flex items-center gap-4 mb-4">
          <Input
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-sm"
          />
          <div className="flex gap-2">
            <Button
              variant={selectedSeverity === 'all' ? 'default' : 'outline'}
              onClick={() => setSelectedSeverity('all')}
            >
              All
            </Button>
            <Button
              variant={selectedSeverity === 'low' ? 'default' : 'outline'}
              onClick={() => setSelectedSeverity('low')}
            >
              Low
            </Button>
            <Button
              variant={selectedSeverity === 'medium' ? 'default' : 'outline'}
              onClick={() => setSelectedSeverity('medium')}
            >
              Medium
            </Button>
            <Button
              variant={selectedSeverity === 'high' ? 'default' : 'outline'}
              onClick={() => setSelectedSeverity('high')}
            >
              High
            </Button>
          </div>
        </div>

        {selectedEvents.length > 0 && (
          <div className="flex items-center gap-2 mb-4">
            <Button variant="destructive" onClick={handleDeleteSelected}>
              Delete Selected ({selectedEvents.length})
            </Button>
          </div>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={selectedEvents.length === filterSecurityEvents().length}
                  onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                />
              </TableHead>
              <TableHead>Timestamp</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Details</TableHead>
              <TableHead>IP Address</TableHead>
              <TableHead>User ID</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filterSecurityEvents().map((event) => (
              <TableRow key={event.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedEvents.includes(event.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedEvents([...selectedEvents, event.id]);
                      } else {
                        setSelectedEvents(selectedEvents.filter(id => id !== event.id));
                      }
                    }}
                  />
                </TableCell>
                <TableCell>{new Date(event.timestamp).toLocaleString()}</TableCell>
                <TableCell>{event.eventType}</TableCell>
                <TableCell>{event.details}</TableCell>
                <TableCell>{event.metadata?.ipAddress || 'unknown'}</TableCell>
                <TableCell>{event.userId}</TableCell>
                <TableCell>
                  <Badge variant={
                    event.severity === 'critical' ? 'destructive' :
                    event.severity === 'high' ? 'destructive' :
                    event.severity === 'medium' ? 'secondary' :
                    'outline'
                  }>
                    {event.severity}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={
                    event.status === 'new' ? 'default' :
                    event.status === 'investigating' ? 'secondary' :
                    event.status === 'resolved' ? 'outline' :
                    'outline'
                  }>
                    {event.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteEvent(event.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}