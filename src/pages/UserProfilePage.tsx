import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/layout/Layout";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useData } from "@/contexts/DataContext";

export default function UserProfilePage() {
  const { user } = useAuth();
  const { regions, districts } = useData();

  if (!user) return <Layout><div className="p-8">Not logged in.</div></Layout>;

  // Lookup region and district names
  const regionName = user.regionId
    ? regions.find(r => r.id === user.regionId)?.name
    : user.region || "N/A";
  const districtName = user.districtId
    ? districts.find(d => d.id === user.districtId)?.name
    : user.district || "N/A";

  return (
    <Layout>
      <div className="container py-6 px-2 sm:px-4 max-w-lg mx-auto">
        <Card className="shadow-lg border-none">
          <CardHeader className="flex flex-col items-center bg-gradient-to-r from-primary/10 to-primary/5 rounded-t-lg pb-6">
            <Avatar className="h-20 w-20 mb-4">
              <AvatarFallback className="text-2xl">
                {user.name?.charAt(0) || user.email?.charAt(0) || "U"}
              </AvatarFallback>
            </Avatar>
            <CardTitle className="text-2xl font-bold mb-1 text-center break-words">{user.name}</CardTitle>
            <div className="text-muted-foreground text-sm text-center break-all">{user.email}</div>
            <div className="mt-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wide text-center">
              {user.role?.replace(/_/g, ' ')}
            </div>
          </CardHeader>
          <CardContent className="py-8 px-2 sm:px-6">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Staff ID</div>
                <div className="font-medium text-base break-all">{user.staffId || 'N/A'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Region</div>
                <div className="font-medium text-base break-words">{regionName}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">District</div>
                <div className="font-medium text-base break-words">{districtName}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Email</div>
                <div className="font-medium text-base break-all">{user.email}</div>
              </div>
            </div>
            <div className="mt-8 text-center text-xs text-muted-foreground">
              For any changes to your profile, please contact your system administrator.
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
} 