"use client";

import { useState } from "react";
import { Button } from "@/portals/super-staff/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/portals/super-staff/components/ui/card";
import { Badge } from "@/portals/super-staff/components/ui/badge";
import { Input } from "@/portals/super-staff/components/ui/input";
import { Modal } from "@/portals/super-staff/components/ui/modal";
import { Toast } from "@/portals/super-staff/components/ui/toast";

export default function KitchenSinkPage() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <main className="min-h-screen bg-gray-50 p-8 space-y-10">
      <h1 className="text-3xl font-bold text-lucena-blue">Kitchen Sink</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Button</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="ghost">Ghost</Button>
          <Button disabled>Disabled</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Card</h2>
        <Card className="max-w-sm">
          <CardHeader>
            <CardTitle>SLA Hours by Level</CardTitle>
            <p className="text-sm text-gray-500">Applies to new records only.</p>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700">Card body content.</p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Badge</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Default</Badge>
          <Badge variant="success">Active</Badge>
          <Badge variant="warning">Scheduled</Badge>
          <Badge variant="destructive">Critical</Badge>
          <Badge variant="info">Super Staff</Badge>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Input</h2>
        <div className="max-w-sm space-y-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="ks-name" className="text-sm font-medium text-gray-900">
              Full name
            </label>
            <Input id="ks-name" placeholder="e.g. Ramon Cruz" />
            <p className="text-xs text-gray-500">Helper text goes here.</p>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="ks-email" className="text-sm font-medium text-gray-900">
              Email
            </label>
            <Input id="ks-email" defaultValue="not-an-email" error="Enter a valid email address." />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Modal</h2>
        <Button variant="destructive" onClick={() => setModalOpen(true)}>
          Deactivate…
        </Button>
        <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
          <h3 className="text-lg font-semibold text-gray-900">
            Deactivate this account?
          </h3>
          <p className="mt-2 text-sm text-gray-600">
            They will lose portal access immediately. This is recorded in the audit log.
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => setModalOpen(false)}>
              Deactivate
            </Button>
          </div>
        </Modal>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Toast</h2>
        <div className="max-w-md space-y-2">
          <Toast variant="success" message="Account created." />
          <Toast variant="error" message="Could not save changes." />
          <Toast variant="info" message="Applies to records created after this change." />
          <Toast variant="warning" message="This is the last active Super Staff account." />
        </div>
      </section>
    </main>
  );
}
