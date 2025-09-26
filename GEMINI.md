# GEMINI.md

## Project Overview

This is a Next.js web application for a streaming service called "Ban12 TV". It is built with TypeScript, Tailwind CSS, and Biome for linting and formatting. The project is configured for internationalization (i18n) and supports both light and dark themes. It uses a component-based architecture and leverages several modern web development technologies to deliver a high-quality user experience.

## Building and Running

To get started with this project, you will need to have Node.js and pnpm installed.

1.  **Install dependencies:**
    ```bash
    pnpm install
    ```

2.  **Run the development server:**
    ```bash
    pnpm dev
    ```
    This will start the development server at `http://localhost:3000`.

3.  **Create a production build:**
    ```bash
    pnpm build
    ```

4.  **Start the production server:**
    ```bash
    pnpm start
    ```

## Development Conventions

*   **Linting and Formatting:** This project uses Biome for linting and formatting. You can run the linter with `pnpm lint` and the formatter with `pnpm format`.
*   **Components:** Components are located in the `components` directory. Reusable UI components are in `components/ui`.
*   **Internationalization:** The project uses `i18n-config.ts` and the `dictionaries` directory to manage translations. The `middleware.ts` file handles locale detection and redirection.
*   **Styling:** Tailwind CSS is used for styling. Global styles are in `app/globals.css`.
*   **Routing:** The app uses a dynamic routing system with the `[lang]` parameter to support multiple languages.
