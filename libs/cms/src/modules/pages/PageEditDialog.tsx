import { useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  IconPicker,
  Input,
  Select,
  SelectItem,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Text,
  Textarea,
  SEMANTIC_COLOR_TOKENS,
  COLOR_INTENSITIES,
  ENTRANCE_ANIMATIONS,
  EXIT_ANIMATIONS,
} from '@inithium/ui';
import type { EntranceAnim, ExitAnim } from '@inithium/ui';
import { useUpdatePageMutation } from '@inithium/api-client';
import type { UpdatePageInput } from '@inithium/api-client';
import type { PageEntity } from '@inithium/db';

// Hardcoded local mirrors of @inithium/db's NAV_LOCATIONS/PAGE_LAYOUT_TEMPLATES rather than
// importing them - every existing frontend import from @inithium/db (see page.endpoints.ts) is
// `import type` only, since @inithium/db's barrel also re-exports the Mongo provider and its
// mongoose-dependent code; importing these as runtime *values* would pull that into the client
// bundle. Small, stable literal arrays, kept in sync by hand.
const NAV_LOCATIONS = ['primary-nav', 'profile-nav', 'primary-footer', 'secondary-footer'] as const;
const PAGE_LAYOUT_TEMPLATES = ['default', 'full-width', 'sidebar-left', 'sidebar-right'] as const;
// Same hardcoded-local-mirror precedent as NAV_LOCATIONS/PAGE_LAYOUT_TEMPLATES above, mirroring
// @inithium/db's CORE_ROLES. This is page-visibility config (who may *view* a published page),
// a separate concern from CMS-editing capabilities - deliberately not conflated with the
// capability keys @inithium/permissions checks.
const CORE_ROLES = ['user', 'contributor', 'editor', 'admin'] as const;

export interface PageEditDialogProps {
  readonly page: PageEntity;
  readonly onDone: () => void;
}

interface ColorFieldsProps {
  readonly label: string;
  readonly colorToken: string;
  readonly intensity: number;
  readonly onColorTokenChange: (value: string) => void;
  readonly onIntensityChange: (value: number) => void;
}

// Reused for both backgroundColor and foregroundColor - a token + intensity Select pair, not
// @inithium/ui's ColorPicker (which works with raw hex, a shape mismatch with PageColorConfig's
// semantic-token model - see the plan's note on this).
const ColorFields = ({ label, colorToken, intensity, onColorTokenChange, onIntensityChange }: ColorFieldsProps) => (
  <Box flex={{ direction: 'row', gap: 12, align: 'end' }}>
    <Select label={`${label} Color`} value={colorToken} onValueChange={onColorTokenChange} className="flex-1">
      {SEMANTIC_COLOR_TOKENS.map((token) => (
        <SelectItem key={token} value={token}>
          {token}
        </SelectItem>
      ))}
    </Select>
    <Select
      label="Intensity"
      value={String(intensity)}
      onValueChange={(value) => onIntensityChange(Number(value))}
      className="w-28 shrink-0"
    >
      {COLOR_INTENSITIES.map((value) => (
        <SelectItem key={value} value={String(value)}>
          {value}
        </SelectItem>
      ))}
    </Select>
  </Box>
);

export const PageEditDialog = ({ page, onDone }: PageEditDialogProps) => {
  const [updatePage, { isLoading }] = useUpdatePageMutation();
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);

  // General
  const [title, setTitle] = useState(page.title);
  const [routePattern, setRoutePattern] = useState(page.routePattern);
  const [layoutTemplate, setLayoutTemplate] = useState(page.layoutTemplate);
  const [isPublished, setIsPublished] = useState(page.isPublished);

  // Appearance - full color objects kept in state (not just color/intensity) so an existing
  // `opacity` value is preserved on save even though this form has no field to edit it: the
  // backend replaces backgroundColor/foregroundColor wholesale, not a deep merge, so omitting a
  // field here would silently wipe it.
  const [animationEnter, setAnimationEnter] = useState<EntranceAnim>(page.animation.enter as EntranceAnim);
  const [animationExit, setAnimationExit] = useState<ExitAnim>(page.animation.exit as ExitAnim);
  const [animationDuration, setAnimationDuration] = useState(page.animation.duration);
  const [animationDelay, setAnimationDelay] = useState(page.animation.delay);
  const [backgroundColor, setBackgroundColor] = useState(page.backgroundColor);
  const [foregroundColor, setForegroundColor] = useState(page.foregroundColor);

  // Access
  const [isPublic, setIsPublic] = useState(page.access.isPublic);
  const [isAnonymousOnly, setIsAnonymousOnly] = useState(page.access.isAnonymousOnly);
  const [requiredRoles, setRequiredRoles] = useState<string[]>(page.access.requiredRoles);

  // Navigation
  const [navLocations, setNavLocations] = useState<string[]>(page.navigation.locations);
  const [navLabel, setNavLabel] = useState(page.navigation.label);
  const [navOrder, setNavOrder] = useState(page.navigation.order);
  const [navIcon, setNavIcon] = useState(page.navigation.icon ?? '');
  const [navParentGroup, setNavParentGroup] = useState(page.navigation.parentGroup ?? '');

  // SEO
  const [metaTitle, setMetaTitle] = useState(page.seo?.metaTitle ?? '');
  const [metaDescription, setMetaDescription] = useState(page.seo?.metaDescription ?? '');
  const [ogImage, setOgImage] = useState(page.seo?.ogImage ?? '');

  const toggleInArray = (list: string[], value: string): string[] =>
    list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];

  const handleSubmit = async () => {
    setSubmitError(undefined);

    const input: UpdatePageInput = {
      id: page.id,
      title,
      routePattern,
      layoutTemplate,
      isPublished,
      animation: {
        enter: animationEnter,
        exit: animationExit,
        duration: animationDuration,
        delay: animationDelay,
      },
      backgroundColor,
      foregroundColor,
      access: { isPublic, isAnonymousOnly, requiredRoles },
      navigation: {
        locations: navLocations as PageEntity['navigation']['locations'],
        label: navLabel,
        order: navOrder,
        icon: navIcon || undefined,
        parentGroup: navParentGroup.trim() || undefined,
      },
      seo: {
        metaTitle: metaTitle || undefined,
        metaDescription: metaDescription || undefined,
        ogImage: ogImage || undefined,
      },
    };

    try {
      await updatePage(input).unwrap();
      onDone();
    } catch {
      setSubmitError('Could not save this page. Check the fields and try again.');
    }
  };

  return (
    <Box flex={{ direction: 'col', gap: 16 }}>
      <Text as="p" className="text-sm text-surface-500">
        Slug: <span className="font-mono">{page.slug}</span> (set by the developer, not editable here)
      </Text>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="access">Access</TabsTrigger>
          <TabsTrigger value="navigation">Navigation</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Box flex={{ direction: 'col', gap: 16 }}>
            <Input label="Title" required value={title} onChange={(event) => setTitle(event.target.value)} />
            <Input
              label="Route Pattern"
              required
              value={routePattern}
              onChange={(event) => setRoutePattern(event.target.value)}
            />
            <Select
              label="Layout Template"
              value={layoutTemplate}
              onValueChange={(value) => setLayoutTemplate(value as PageEntity['layoutTemplate'])}
            >
              {PAGE_LAYOUT_TEMPLATES.map((template) => (
                <SelectItem key={template} value={template}>
                  {template}
                </SelectItem>
              ))}
            </Select>
            <Switch label="Published" checked={isPublished} onCheckedChange={setIsPublished} />
          </Box>
        </TabsContent>

        <TabsContent value="appearance">
          <Box flex={{ direction: 'col', gap: 16 }}>
            <Box flex={{ direction: 'row', gap: 12 }}>
              <Select
                label="Animation Enter"
                value={animationEnter}
                onValueChange={(value) => setAnimationEnter(value as EntranceAnim)}
                className="flex-1"
              >
                {ENTRANCE_ANIMATIONS.map((anim) => (
                  <SelectItem key={anim} value={anim}>
                    {anim}
                  </SelectItem>
                ))}
              </Select>
              <Select
                label="Animation Exit"
                value={animationExit}
                onValueChange={(value) => setAnimationExit(value as ExitAnim)}
                className="flex-1"
              >
                {EXIT_ANIMATIONS.map((anim) => (
                  <SelectItem key={anim} value={anim}>
                    {anim}
                  </SelectItem>
                ))}
              </Select>
            </Box>
            <Box flex={{ direction: 'row', gap: 12 }}>
              <Input
                label="Duration (ms)"
                type="number"
                value={animationDuration}
                onChange={(event) => setAnimationDuration(Number(event.target.value))}
                className="flex-1"
              />
              <Input
                label="Delay (ms)"
                type="number"
                value={animationDelay}
                onChange={(event) => setAnimationDelay(Number(event.target.value))}
                className="flex-1"
              />
            </Box>
            <ColorFields
              label="Background"
              colorToken={backgroundColor.color}
              intensity={backgroundColor.intensity ?? 500}
              onColorTokenChange={(value) => setBackgroundColor((prev) => ({ ...prev, color: value }))}
              onIntensityChange={(value) => setBackgroundColor((prev) => ({ ...prev, intensity: value }))}
            />
            <ColorFields
              label="Foreground"
              colorToken={foregroundColor.color}
              intensity={foregroundColor.intensity ?? 500}
              onColorTokenChange={(value) => setForegroundColor((prev) => ({ ...prev, color: value }))}
              onIntensityChange={(value) => setForegroundColor((prev) => ({ ...prev, intensity: value }))}
            />
          </Box>
        </TabsContent>

        <TabsContent value="access">
          <Box flex={{ direction: 'col', gap: 16 }}>
            <Switch label="Public" checked={isPublic} onCheckedChange={setIsPublic} />
            <Switch label="Anonymous visitors only" checked={isAnonymousOnly} onCheckedChange={setIsAnonymousOnly} />
            <Box flex={{ direction: 'col', gap: 8 }}>
              <Text as="span" className="text-sm font-medium text-surface-900">
                Required Roles
              </Text>
              {CORE_ROLES.map((role) => (
                <Checkbox
                  key={role}
                  label={role}
                  checked={requiredRoles.includes(role)}
                  onCheckedChange={() => setRequiredRoles((prev) => toggleInArray(prev, role))}
                />
              ))}
            </Box>
          </Box>
        </TabsContent>

        <TabsContent value="navigation">
          <Box flex={{ direction: 'col', gap: 16 }}>
            <Box flex={{ direction: 'col', gap: 8 }}>
              <Text as="span" className="text-sm font-medium text-surface-900">
                Nav Locations
              </Text>
              {NAV_LOCATIONS.map((location) => (
                <Checkbox
                  key={location}
                  label={location}
                  checked={navLocations.includes(location)}
                  onCheckedChange={() => setNavLocations((prev) => toggleInArray(prev, location))}
                />
              ))}
            </Box>
            <Input label="Nav Label" value={navLabel} onChange={(event) => setNavLabel(event.target.value)} />
            <Input
              label="Nav Order"
              type="number"
              value={navOrder}
              onChange={(event) => setNavOrder(Number(event.target.value))}
            />
            <IconPicker label="Nav Icon" value={navIcon} onValueChange={setNavIcon} />
            <Input
              label="Nested Under"
              placeholder="e.g. Offerings"
              helperText="Optional. Any other page sharing this exact value collapses into one dropdown with this label, in place of a flat link. Leave blank for a normal top-level link."
              value={navParentGroup}
              onChange={(event) => setNavParentGroup(event.target.value)}
            />
          </Box>
        </TabsContent>

        <TabsContent value="seo">
          <Box flex={{ direction: 'col', gap: 16 }}>
            <Input label="Meta Title" value={metaTitle} onChange={(event) => setMetaTitle(event.target.value)} />
            <Textarea
              label="Meta Description"
              value={metaDescription}
              onChange={(event) => setMetaDescription(event.target.value)}
            />
            <Input label="OG Image URL" value={ogImage} onChange={(event) => setOgImage(event.target.value)} />
          </Box>
        </TabsContent>
      </Tabs>

      {submitError ? (
        <Text as="p" className="text-sm text-red-600">
          {submitError}
        </Text>
      ) : null}

      <Box flex={{ direction: 'row', gap: 8, justify: 'end' }}>
        <Button variant={{ kind: 'ghost', color: 'surface' }} onClick={onDone} disabled={isLoading}>
          Cancel
        </Button>
        <Button variant={{ kind: 'filled', color: 'primary' }} onClick={handleSubmit} disabled={isLoading}>
          {isLoading ? 'Saving…' : 'Save Changes'}
        </Button>
      </Box>
    </Box>
  );
};
