import { connection } from 'next/server';
export default async function Page(){await connection();await new Promise(r=>setTimeout(r,2000));return <h1>Navigation complete</h1>;}
