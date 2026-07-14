"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CreditCard, DollarSign, Receipt, Wallet } from "lucide-react";

export default function BudgetPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Budget</h1>
          <p className="mt-1 text-muted-foreground">
            Real spend will appear after billing, model usage, and channel costs are connected.
          </p>
        </div>
        <Button>Set Monthly Limit</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Monthly Limit</p>
              <Wallet className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="mt-2 text-3xl font-bold">$0</p>
            <Badge variant="secondary" className="mt-3">Not set</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Recorded Spend</p>
              <DollarSign className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="mt-2 text-3xl font-bold">$0</p>
            <Progress value={0} className="mt-3 h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Invoices</p>
              <Receipt className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="mt-2 text-3xl font-bold">0</p>
            <Badge variant="secondary" className="mt-3">No billing source</Badge>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
        </CardHeader>
        <CardContent className="py-12 text-center">
          <CreditCard className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-medium">No real transactions recorded</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Model costs, channel fees, subscriptions, and invoices will appear here after billing sources are connected.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
