import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";

export default function Unauthorized() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-yellow-500" />
            <h1 className="text-2xl font-bold text-gray-900">訪問被拒絕</h1>
          </div>

          <p className="mt-4 text-sm text-gray-600">
            您沒有權限訪問此頁面。
          </p>

          {user && (
            <p className="mt-2 text-sm text-gray-500">
              您的角色: <span className="font-semibold">{user.role}</span>
            </p>
          )}

          <div className="mt-6 flex gap-2">
            <Button
              onClick={() => setLocation('/')}
              variant="outline"
            >
              返回首頁
            </Button>
            <Button
              onClick={() => setLocation('/profile')}
            >
              查看個人資料
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

