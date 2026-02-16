import Text "mo:base/Text";

module {
  type OldActor = {
    adminPassword : Text;
  };

  type NewActor = {};

  public func run(_ : OldActor) : NewActor {
    {};
  };
};
