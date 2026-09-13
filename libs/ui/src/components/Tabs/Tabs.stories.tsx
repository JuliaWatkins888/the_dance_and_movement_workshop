import type { Meta, StoryObj } from '@storybook/react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './Tabs';
import { Text } from '../Text/Text';

const meta: Meta<typeof Tabs> = {
  title: 'Inputs/Tabs',
  component: Tabs,
  args: {
    defaultValue: 'account',
  },
};

export default meta;
type Story = StoryObj<typeof Tabs>;

export const Default: Story = {
  render: (args) => (
    <Tabs {...args}>
      <TabsList>
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="billing">Billing</TabsTrigger>
      </TabsList>
      <TabsContent value="account">
        <Text as="p">Account settings go here.</Text>
      </TabsContent>
      <TabsContent value="billing">
        <Text as="p">Billing settings go here.</Text>
      </TabsContent>
    </Tabs>
  ),
};

export const WithDisabledTab: Story = {
  render: (args) => (
    <Tabs {...args}>
      <TabsList>
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="billing" disabled>
          Billing
        </TabsTrigger>
      </TabsList>
      <TabsContent value="account">
        <Text as="p">Account settings go here.</Text>
      </TabsContent>
      <TabsContent value="billing">
        <Text as="p">Billing settings go here.</Text>
      </TabsContent>
    </Tabs>
  ),
};
