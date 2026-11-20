import {webcrypto} from 'node:crypto';
const keys=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
const pub=Buffer.from(await webcrypto.subtle.exportKey('raw',keys.publicKey)).toString('base64url');
const privateJwk=await webcrypto.subtle.exportKey('jwk',keys.privateKey);
console.log('VAPID_PUBLIC_KEY='+pub);
console.log('VAPID_PRIVATE_KEY='+privateJwk.d);
console.log('Guarde a chave privada apenas em Cloudflare Secrets. Não a publique nem envie em conversas.');
