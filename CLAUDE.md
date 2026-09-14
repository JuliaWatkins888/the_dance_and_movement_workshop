Repository Master Blueprint: the\_dance\_and\_movement\_workshop
================================================================

1\. Executive Summary & Core Philosophy
---------------------------------------

the\_dance\_and\_movement\_workshop is a full-stack domain application generated from the **Inithium** scaffolding ecosystem. While this repository contains specific domain logic for managing workshop schedules, participant registrations, movement classes, and event administration, it strictly adheres to the architectural patterns, functional paradigms, and package composition standards established by the Inithium monorepo blueprint.

### Operational Relationship to Inithium

*   **Upstream Origin:** Built using inithium init (@inithium/source template base).
    
*   **Domain Focus:** Dance and movement workshop operations, scheduling, user accounts, and dynamic content management.
    
*   **Architectural Lineage:** Preserves Inithium's pure functional programming standards, thin orchestrator hosts (apps/), shared domain libraries (libs/), abstract service boundaries, and Tailwind v4 CSS token system.
    

### Architectural Principles

*   **Pure Functional Programming:** Avoid OOP classes, mutating state, or this contexts. Write pure deterministic functions, functional compositions, factory functions, and immutability primitives.
    
*   **Thin Orchestrator Applications:** Applications inside apps/ (apps/web, apps/api) act strictly as thin consumption hosts (bootstrapping, environment configuration, route mounting, server listening). All core domain logic, schema definitions, database infrastructure, state slices, and UI components live inside reusable packages under libs/.
    
*   **Heavy Abstraction & Scalable Encapsulation:** Decouple domain logic from platform infrastructure. Wrap raw DB queries, HTTP transports, third-party libraries, and UI components behind abstract interfaces exported via workspace packages (@inithium/db, @inithium/ui, etc.).
    
*   **Pragmatic Commenting Standard:** Write comments _only_ where they add value to complex logic, non-obvious algorithms, or code tracing. Strictly avoid redundant, self-evident comments that restate what the code clearly expresses.
    
*   **Ejected Blueprints & Module Reusability:** Features and modules injected from Inithium plugins exist as live, customizable TypeScript source code inside this repository. Customize freely while maintaining the structural contract of libs/.
    

2\. Technology Stack Standards
------------------------------

### Backend Architecture (apps/api + libs/db, libs/api-core, libs/\*)

*   **Runtime & Server:** Node.js (v20+), Express.js (thin host in apps/api).
    
*   **Validation:** Zod for runtime schema validation (environment variables, HTTP request bodies, headers, and query parameters).
    
*   **Database & ODM:** MongoDB with Mongoose via @inithium/db package (strict schema typing, connection pooling, lean queries by default).
    
*   **Authentication:** JWT (JSON Web Tokens) with stateless bearer token authorization middleware in @inithium/auth.
    
*   **TypeScript:** Strict mode enabled (noImplicitAny, strictNullChecks, exactOptionalPropertyTypes).
    

### Frontend Architecture (apps/web + libs/ui, libs/state, libs/api-client)

*   **UI Engine & Templating:** React (v18+), TypeScript (thin shell host in apps/web).
    
*   **State & Data Fetching:**
    
    *   Redux Toolkit (RTK) for complex client-side state slices inside @inithium/state.
        
    *   RTK Query (baseApi) inside @inithium/api-client for unified server-side data fetching, caching, and tag-based cache invalidation.
        
*   **Design System & Styling:** Tailwind CSS v4, custom theme engine with CSS variable tokens via @inithium/ui.
    
*   **UI Primitives:** Headless, accessible primitives via Radix UI (@radix-ui/\*) inside @inithium/ui.
    

3\. Directory Layout & Repository Boundaries
--------------------------------------------

Plaintext

Plain textANTLR4BashCC#CSSCoffeeScriptCMakeDartDjangoDockerEJSErlangGitGoGraphQLGroovyHTMLJavaJavaScriptJSONJSXKotlinLaTeXLessLuaMakefileMarkdownMATLABMarkupObjective-CPerlPHPPowerShell.propertiesProtocol BuffersPythonRRubySass (Sass)Sass (Scss)SchemeSQLShellSwiftSVGTSXTypeScriptWebAssemblyYAMLXML`   the_dance_and_movement_workshop/  ├── apps/  │   ├── api/                  # Thin Express orchestrator (server listener & route mounting)  │   └── web/                  # Thin React orchestrator (app router & global providers)  ├── libs/                     # Reusable domain workspace packages  │   ├── api-client/           # Shared RTK Query baseApi and endpoint slices  │   ├── api-core/             # Core route definitions & backend business logic  │   ├── auth/                 # JWT helpers, hashing utilities, and auth middleware  │   ├── cms/                  # Modular CMS engine, dynamic admin modules & dashboard widgets  │   ├── db/                   # Provider-agnostic contracts, mongoose schemas & database driver  │   ├── state/                # Global Redux store & state slices  │   └── ui/                   # Tailwind v4 theme, Radix primitives, and UI component library  ├── .inithium/  │   └── plugins.lock.json     # Tracks injected Inithium modules and feature dependencies  ├── inithium_postman_import.json # Postman collection for API verification  ├── nx.json                   # Nx workspace execution config  ├── package.json              # Monorepo root package.json (@inithium/source)  ├── tsconfig.base.json        # Base tsconfig containing "@inithium/*" path aliases to libs/*  └── CLAUDE.md                 # System Blueprint & AI Operational Guide (this file)   `

> **Note:** .inithium/plugins.lock.json is maintained at runtime inside consumer workspaces to track installed Inithium plugins and resolve dependencies.

4\. Contract Specifications & Extension Patterns
------------------------------------------------

### Package Architecture & Configuration Standards (libs/\*)

All shared packages under libs/ follow these strict workspace setup guidelines:

1.  **Package Manifest (package.json):** Must explicitly specify "type": "module" to align ESM exports across build outputs.
    
2.  **Nx Project Configuration (project.json):** Must explicitly define both build and type-check targets:
    

JSON

Plain textANTLR4BashCC#CSSCoffeeScriptCMakeDartDjangoDockerEJSErlangGitGoGraphQLGroovyHTMLJavaJavaScriptJSONJSXKotlinLaTeXLessLuaMakefileMarkdownMATLABMarkupObjective-CPerlPHPPowerShell.propertiesProtocol BuffersPythonRRubySass (Sass)Sass (Scss)SchemeSQLShellSwiftSVGTSXTypeScriptWebAssemblyYAMLXML`   {    "name": "package-name",    "$schema": "../../node_modules/nx/schemas/project-schema.json",    "sourceRoot": "libs/package-name/src",    "projectType": "library",    "targets": {      "build": {        "executor": "@nx/js:tsc",        "outputs": ["{options.outputPath}"],        "options": {          "outputPath": "dist/libs/package-name",          "main": "libs/package-name/src/index.ts",          "tsConfig": "libs/package-name/tsconfig.lib.json"        }      },      "type-check": {        "executor": "nx:run-commands",        "options": {          "command": "tsc --noEmit -p libs/package-name/tsconfig.lib.json"        }      }    }  }   `

1.  **TypeScript Path Aliases (tsconfig.base.json):** Under "moduleResolution": "bundler", all path alias target values must start explicitly with ./ (e.g., "@inithium/db": \["./libs/db/src/index.ts"\]).
    

### Reusing & Extending Existing Inithium Infrastructure

When building new domain features for **The Dance and Movement Workshop**:

*   **Do NOT re-create primitive components or database connection handlers.** Re-export and compose existing abstractions from @inithium/ui and @inithium/db.
    
*   **Database Schemas & Contracts:** Place domain contracts (e.g., WorkshopEntity, InstructorEntity, BookingEntity) in libs/db/src/contracts/ and their corresponding Mongoose schemas in libs/db/src/schemas/.
    
*   **Frontend RTK Query Endpoint Injection:** Inject new feature endpoints into the existing base API. Do **never** instantiate secondary API slices:
    

TypeScript

Plain textANTLR4BashCC#CSSCoffeeScriptCMakeDartDjangoDockerEJSErlangGitGoGraphQLGroovyHTMLJavaJavaScriptJSONJSXKotlinLaTeXLessLuaMakefileMarkdownMATLABMarkupObjective-CPerlPHPPowerShell.propertiesProtocol BuffersPythonRRubySass (Sass)Sass (Scss)SchemeSQLShellSwiftSVGTSXTypeScriptWebAssemblyYAMLXML`   import { baseApi } from './baseApi';  export const workshopApi = baseApi.injectEndpoints({    endpoints: (builder) => ({      getWorkshops: builder.query({        query: () => '/workshops',        providesTags: ['Workshop'],      }),    }),  });  export const { useGetWorkshopsQuery } = workshopApi;   `

### CMS Extension Pattern (Admin Modules & Dashboard Widgets)

*   **Admin Modules:** @inithium/cms discovers admin modules dynamically at build time by scanning libs/cms/src/modules/\*.module.tsx via Vite's import.meta.glob. To add a new workshop management screen, drop a uniquely named \*.module.tsx file default-exporting a { id, navLabel, icon, order?, Component } descriptor.
    
*   **Dashboard Widgets:** Add custom dashboard widgets by placing files in libs/cms/src/dashboard/widgets/\*.widget.tsx default-exporting a { id, title?, order?, span?, Component } descriptor (DashboardWidget).
    
    *   span (1 | 2 | 3, default 1) dictates how many columns of the responsive 3-column grid the widget occupies.
        

5\. Theming & Semantic Color Tokens
-----------------------------------

@inithium/ui ships a two-layer theme (libs/ui/src/theme/theme.css): a brand layer of --ui-\* CSS custom properties, and a @theme block that registers each one into Tailwind v4's --color-\* namespace. Every semantic token behaves like a standard Tailwind color utility (bg-primary-500, text-primary-foreground-500, border-surface-950/40). Rebrand the workshop platform by redefining --ui-\* variables — never by altering underlying component code.

### The 11 Semantic Base Colors

The palette's base is the 500-intensity, 100%-opacity shade of each token:

*   **5 Raw Brand Colors:** primary, secondary, accent, tertiary, quaternary. Direct branding colors used to convey aesthetic style.
    
    *   primary: Core actions, primary buttons, major CTAs.
        
    *   accent: High-contrast interaction affordances — hover states, highlights, focus rings.
        
    *   secondary, tertiary, quaternary: Supplementary brand texture.
        
*   **5 Foreground Colors:** primary-foreground, secondary-foreground, accent-foreground, tertiary-foreground, quaternary-foreground. Opposite-contrast partners guaranteed to render legible text/icons/borders on top of their matching raw brand color at the same intensity (e.g., bg-primary-500 pairs with text-primary-foreground-500).
    
*   **1 Surface Color:** surface. Surface has no branding intent and relies on a sliding intensity scale (100 → 950) to separate UI layers (page backgrounds, panels, cards, navbars).
    

### Intensity and Opacity Specifications

Components pass a ColorSpec (libs/ui/src/contracts/color.contract.ts) resolved dynamically by resolveColorClass:

TypeScript

Plain textANTLR4BashCC#CSSCoffeeScriptCMakeDartDjangoDockerEJSErlangGitGoGraphQLGroovyHTMLJavaJavaScriptJSONJSXKotlinLaTeXLessLuaMakefileMarkdownMATLABMarkupObjective-CPerlPHPPowerShell.propertiesProtocol BuffersPythonRRubySass (Sass)Sass (Scss)SchemeSQLShellSwiftSVGTSXTypeScriptWebAssemblyYAMLXML`   export interface ColorSpec {    readonly color: string;              // Semantic token ('primary', 'surface', ...)    readonly intensity?: ColorIntensity; // 100 | 200 | ... | 950    readonly opacity?: ColorOpacity;     // 10 | 20 | ... | 90  }   `

TypeScript

Plain textANTLR4BashCC#CSSCoffeeScriptCMakeDartDjangoDockerEJSErlangGitGoGraphQLGroovyHTMLJavaJavaScriptJSONJSXKotlinLaTeXLessLuaMakefileMarkdownMATLABMarkupObjective-CPerlPHPPowerShell.propertiesProtocol BuffersPythonRRubySass (Sass)Sass (Scss)SchemeSQLShellSwiftSVGTSXTypeScriptWebAssemblyYAMLXML`   resolveColorClass('bg', { color: 'primary', intensity: 500 });                 // "bg-primary-500"  resolveColorClass('text', { color: 'primary-foreground', intensity: 500 });        // "text-primary-foreground-500"  resolveColorClass('border', { color: 'surface', intensity: 950, opacity: 40 }); // "border-surface-950/40"   `

### Color & Dark Mode Rules of Thumb

*   **No Hardcoded Hexes / Palette Colors:** Never hardcode hex values or raw Tailwind colors (bg-blue-500, text-gray-900) for containers, backgrounds, or text. Always resolve through semantic tokens.
    
*   **Dark Mode Auto-Inversion:** Dark mode is handled via CSS variable inversion of the --ui-surface-\* and --ui-surface-foreground-\* scales in :root\[data-theme='dark'\].
    
*   **Text Color Requirement:** Every text-bearing element **must** declare an explicit surface token (e.g., textColor={{ color: 'surface', intensity: 950 }} or text-surface-950). Leaving text without an explicit surface color causes it to fall back to unstyled browser defaults that fail to invert in dark mode.
    
*   **Intensity Safelisting:** Only exact 100-step intensities (100, 200, ..., 950) are valid. Non-standard values (e.g., surface-1000) produce invalid classes and fail to render correctly.
    

6\. API Documentation & Testing Guidelines
------------------------------------------

### API Route Modifications & Postman Collection

When adding, modifying, or removing backend routes in apps/api or @inithium/api-core:

*   **Postman Collection Location:** Maintain and update the Postman collection at:inithium\_postman\_import.json
    
*   **Collection Standards:**
    
    *   Place new endpoints inside their respective module folder within the item array.
        
    *   Use variable placeholders ({{baseUrl}}, {{accessToken}}) for host, paths, and authorization headers.
        
    *   Provide test scripts in the event array to validate response status codes.
        

7\. Developer & AI Assistant Workflow Instructions
--------------------------------------------------

### Application Verification

Server restarts, builds, and manual verification are performed **manually by the developer**. AI agents must **not** attempt to run long-lived dev servers or execute browser automation.

Verification commands:

Bash

Plain textANTLR4BashCC#CSSCoffeeScriptCMakeDartDjangoDockerEJSErlangGitGoGraphQLGroovyHTMLJavaJavaScriptJSONJSXKotlinLaTeXLessLuaMakefileMarkdownMATLABMarkupObjective-CPerlPHPPowerShell.propertiesProtocol BuffersPythonRRubySass (Sass)Sass (Scss)SchemeSQLShellSwiftSVGTSXTypeScriptWebAssemblyYAMLXML`   # Run type checking across a specific package  npx nx run db:type-check  # Build a specific package or application  npx nx build db  # Build all apps and packages in the workspace  npx nx run-many -t=build --all  # Serve all apps in the workspace  npx nx run-many -t=serve --all   `

### Git & Pull Request Strategy

When task requirements are completed and verified:

Bash

Plain textANTLR4BashCC#CSSCoffeeScriptCMakeDartDjangoDockerEJSErlangGitGoGraphQLGroovyHTMLJavaJavaScriptJSONJSXKotlinLaTeXLessLuaMakefileMarkdownMATLABMarkupObjective-CPerlPHPPowerShell.propertiesProtocol BuffersPythonRRubySass (Sass)Sass (Scss)SchemeSQLShellSwiftSVGTSXTypeScriptWebAssemblyYAMLXML`   # 1. Create and switch to a dedicated feature branch  git checkout -b feature/workshop-scheduling  # 2. Stage all modifications  git add .  # 3. Commit changes with a descriptive message  git commit -m 'feat: implement workshop schedule models and api endpoints'  # 4. Push branch to remote GitHub repository  git push origin feature/workshop-scheduling  # 5. OPEN PULL REQUEST MANUALLY IN GITHUB UI -> Merge into main  # 6. Return to local main branch and pull remote changes  git checkout main && git pull   `