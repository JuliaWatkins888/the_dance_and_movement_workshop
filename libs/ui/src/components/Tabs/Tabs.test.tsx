import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './Tabs';

describe('Tabs', () => {
  it('shows the default tab content and hides the inactive pane', () => {
    render(
      <Tabs defaultValue="account">
        <TabsList>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>
        <TabsContent value="account">Account content</TabsContent>
        <TabsContent value="billing">Billing content</TabsContent>
      </Tabs>,
    );

    expect(screen.getByText('Account content')).toBeInTheDocument();
    expect(screen.queryByText('Billing content')).not.toBeInTheDocument();
  });

  it('switches panes when a trigger is clicked', async () => {
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="account">
        <TabsList>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>
        <TabsContent value="account">Account content</TabsContent>
        <TabsContent value="billing">Billing content</TabsContent>
      </Tabs>,
    );

    await user.click(screen.getByRole('tab', { name: 'Billing' }));

    expect(screen.getByText('Billing content')).toBeInTheDocument();
    expect(screen.queryByText('Account content')).not.toBeInTheDocument();
  });

  it('does not activate a disabled trigger', async () => {
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="account">
        <TabsList>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="billing" disabled>
            Billing
          </TabsTrigger>
        </TabsList>
        <TabsContent value="account">Account content</TabsContent>
        <TabsContent value="billing">Billing content</TabsContent>
      </Tabs>,
    );

    await user.click(screen.getByRole('tab', { name: 'Billing' }));

    expect(screen.getByText('Account content')).toBeInTheDocument();
  });
});
