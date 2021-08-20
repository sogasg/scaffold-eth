import React from "react";
import { Typography, Steps } from "antd";
const { Step } = Steps;
const { Text, Title } = Typography;

export default function Welcome() {
  return (
    <div style={{ padding: 16, width: 400, margin: "auto", marginTop: 64 }}>
      <Title level={2}>Welcome to the result dependent payment example</Title>
      <Text>
        This is an example of a payment that is dependent on some result. The admin page is where a safe can be deployed
        with a set of evaluators (signers) and where result-dependent payments can be initiated. The evaluator's task is
        to answer the question(s) in the Evaluator UI.
      </Text>
      <Title level={3}>Flow</Title>
      <Steps direction="vertical">
        <Step
          title="Create transaction"
          description="A builder will get paid 1 ETH if the builder implements the sign-in with Ethereum flow and publishes it to xyz.com"
          status="process"
        />
        <Step
          title="Evaluation"
          description="The evaluators open the Evaluator UI and verify the claim if it's true."
          status="process"
        />
        <Step
          title="Payment execution"
          description="Once/if the threshold is met, the transaction can be executed, and the builder will be paid."
          status="process"
        />
      </Steps>
    </div>
  );
}
