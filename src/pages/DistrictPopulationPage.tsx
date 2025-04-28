import React from 'react';
import { Layout } from '@/components/layout/Layout';
import { DistrictPopulationForm } from '@/components/user-management/DistrictPopulationForm';
import { AccessControlWrapper } from '@/components/access-control/AccessControlWrapper';

export default function DistrictPopulationPage() {
  return (
    <AccessControlWrapper type="district_population">
      <Layout>
        <div className="container py-8">
          <h1 className="text-3xl font-bold tracking-tight">District Population Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage population data for districts
          </p>
          <div className="mt-6">
            <DistrictPopulationForm />
          </div>
        </div>
      </Layout>
    </AccessControlWrapper>
  );
} 