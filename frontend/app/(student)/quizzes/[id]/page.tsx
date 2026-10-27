import { RemoteActivity } from '@/app/components/student/remote-activity';
export const instant = false;
export default async function Page({params}: {params:Promise<{id:string}>}) { const {id}=await params; return <RemoteActivity key={id} kind="quizzes" id={id}/>; }
