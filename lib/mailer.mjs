import nodemailer from 'nodemailer';
export function createMailer(env=process.env){
  const port=Number(env.SMTP_PORT||587),secure=env.SMTP_SECURE==='true';
  const enabled=!!(env.SMTP_HOST&&env.SMTP_USER&&env.SMTP_PASSWORD&&env.SMTP_FROM&&Number.isInteger(port)&&port>0&&port<65536&&/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(env.SMTP_FROM));
  const transport=enabled?nodemailer.createTransport({host:env.SMTP_HOST,port,secure,requireTLS:!secure,auth:{user:env.SMTP_USER,pass:env.SMTP_PASSWORD},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000,disableFileAccess:true,disableUrlAccess:true,logger:false,debug:false}):null;
  return {enabled,verify:()=>transport?.verify(),async send({to,url}){
    if(!transport)throw new Error('SMTP is not configured');
    const info=await transport.sendMail({from:{name:'HANDARI',address:env.SMTP_FROM},to,subject:'HANDARI — Нууц үг сэргээх',text:`HANDARI нууц үгээ шинэчлэх бол дараах холбоосыг нээнэ үү:\n\n${url}\n\nХолбоос 20 минутын хугацаатай, нэг удаа ашиглагдана. Та хүсэлт гаргаагүй бол энэ имэйлийг үл тоомсорлоорой. Нууц үгээ бусдад бүү дамжуулаарай.`});
    if(!info.accepted?.length||info.rejected?.length)throw new Error('SMTP recipient was not accepted');
  }};
}
