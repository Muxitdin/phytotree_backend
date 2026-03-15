import { createHash } from "crypto";

export interface ClickSignatureParams {
  clickTransId: string;
  serviceId: string;
  merchantTransId: string;
  merchantPrepareId?: string;
  amount: number;
  action: number;
  signTime: string;
  signString: string;
}

export function validateClickSignature(
  params: ClickSignatureParams,
  secretKey: string,
): boolean {
  const prepareId = params.merchantPrepareId || "";

  const signatureSource = [
    params.clickTransId,
    params.serviceId,
    secretKey,
    params.merchantTransId,
    prepareId,
    params.amount,
    params.action,
    params.signTime,
  ].join("");

  const expectedSign = createHash("md5").update(signatureSource).digest("hex");

  return expectedSign === params.signString;
}

export function generateClickPaymentUrl(params: {
  serviceId: string;
  merchantId: string;
  orderId: string;
  amount: number;
  returnUrl: string;
}): string {
  const baseUrl = "https://my.click.uz/services/pay";

  const queryParams = new URLSearchParams({
    service_id: params.serviceId,
    merchant_id: params.merchantId,
    amount: params.amount.toString(),
    transaction_param: params.orderId,
    return_url: params.returnUrl,
  });

  return `${baseUrl}?${queryParams.toString()}`;
}
