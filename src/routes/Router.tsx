import { createBrowserRouter } from "react-router-dom";
import type { RouteObject } from "react-router-dom";
import { Landing } from "../pages/Landing";  // <-- NEW
import { POS } from "../pages/POS";
import { Root } from "../layout/Root";
import { Products } from "../pages/Products";
import { RFIDCards } from "../pages/RFIDCards";
import { Dashboard } from "../pages/Dashboard";

export const router: RouteObject[] = [
  // Landing page - public, no layout wrapper
  {
    path: "/",
    element: <Landing />,
  },
  // App pages - protected, with Root layout (sidebar + auth check)
  {
    path: "/",
    element: <Root />,
    children: [
      {
        path: "/pos",
        element: <POS />,
      },
      {
        path: "/products",
        element: <Products />,
      },
      {
        path: "/cards",
        element: <RFIDCards />,
      },
      {
        path: "/dashboard",
        element: <Dashboard />,
      },
    ],
  },
];

export const appRouter = createBrowserRouter(router);