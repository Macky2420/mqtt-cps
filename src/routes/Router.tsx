import { createBrowserRouter } from "react-router-dom";
import type { RouteObject } from "react-router-dom";
import { Landing } from "../pages/Landing";
import { POS } from "../pages/POS";
import { Root } from "../layout/Root";
import { Products } from "../pages/Products";
import { RFIDCards } from "../pages/RFIDCards";
import { Dashboard } from "../pages/Dashboard";
import { TopUpSuccess } from "../pages/TopUpSuccess";   // <-- ADD
import { TopUpFailed } from "../pages/TopUpFailed";

export const router: RouteObject[] = [
  // Landing page - public, no layout wrapper
  {
    path: "/",
    element: <Landing />,
  },
  
  // Top-up success page - public, outside Root layout
  // User returns here from GCash/Maya after payment
  {
    path: "/topup/success",
    element: <TopUpSuccess />,
  },
   {
    path: "/topup/failed",
    element: <TopUpFailed />,
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