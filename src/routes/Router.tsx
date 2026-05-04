import { createBrowserRouter } from "react-router-dom";
import type { RouteObject } from "react-router-dom";
import {POS} from "../pages/POS";
import {Root} from "../layout/Root";
import {Products} from "../pages/Products";
import {RFIDCards} from "../pages/RFIDCards";
import { Dashboard } from "../pages/Dashboard";


export const router: RouteObject[] = [
   {
        path: "/",
        element: <Root/>,
        children: [
            {
                path: "/",
                element: <POS/>
            }
        ]
    },
    {
        path: "/",
        element: <Root/>,
        children: [
            {
                path: "/products",
                element: <Products/>
            }
        ]
    },
        {
            path: "/",
            element: <Root/>,
            children: [
                {
                    path: "/cards",
                    element: <RFIDCards/>
                }
            ]
        },
        {
        path: "/",
        element: <Root/>,
        children: [
            {
                path: "/dashboard",
                element: <Dashboard/>
            }
        ]
    }
];

export const appRouter = createBrowserRouter(router);