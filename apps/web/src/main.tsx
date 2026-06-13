import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { App } from './App';
import './styles.css';
const queryClient=new QueryClient();
const router=createBrowserRouter([{path:'/',element:<App/>}]);
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(<React.StrictMode><QueryClientProvider client={queryClient}><RouterProvider router={router}/></QueryClientProvider></React.StrictMode>);
