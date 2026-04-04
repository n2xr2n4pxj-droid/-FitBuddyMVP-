import { Switch, Route, Redirect } from "wouter";
import LandingPage from "@/pages/auth/LandingPage";
import AuthLoginPage from "@/pages/auth/LoginPage";
import RegisterFlow from "@/pages/auth/RegisterFlow/RegisterFlow";
import VerifyEmailPrompt from "@/pages/VerifyEmailPrompt";

/**
 * 未登入時的公開路由（須由父層保證僅在 !isLoggedIn 時渲染）。
 * 路徑需與 LandingPage / LoginPage / RegisterFlow 內 setLocation 一致。
 */
export default function UnauthenticatedRoutes() {
  return (
    <Switch>
      <Route path="/login" component={AuthLoginPage} />
      <Route path="/register-flow" component={RegisterFlow} />
      <Route path="/verify-email-prompt" component={VerifyEmailPrompt} />
      <Route path="/" component={LandingPage} />
      <Route>
        <Redirect to="/" />
      </Route>
    </Switch>
  );
}
